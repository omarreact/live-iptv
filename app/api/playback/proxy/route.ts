import { assertSafeUrl } from "@/lib/iptv/proxy.server";
import { getPlaybackProvider } from "@/lib/providers/registry.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BLOCKED_UPSTREAM_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
]);

const MAX_REDIRECTS = 4;

const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
] as const;

function isManifestContentType(value: string | null, sourceUrl: string): boolean {
  const type = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  const path = new URL(sourceUrl).pathname.toLowerCase();
  return (
    type.includes("mpegurl") ||
    type.includes("dash+xml") ||
    path.endsWith(".m3u8") ||
    path.endsWith(".mpd")
  );
}

function manifestChildUrl(
  origin: string,
  sourceUrl: URL,
  child: string,
  query: URLSearchParams,
): string {
  const target = new URL(child, sourceUrl);
  if (target.hostname !== sourceUrl.hostname) return target.href;

  const next = new URL("/api/playback/proxy", origin);
  for (const [key, value] of query) {
    if (key !== "target") next.searchParams.set(key, value);
  }
  next.searchParams.set("target", target.href);
  return next.href;
}

function rewriteManifest(
  text: string,
  sourceUrl: string,
  origin: string,
  query: URLSearchParams,
): string {
  const base = new URL(sourceUrl);
  const rewrite = (value: string): string => {
    try {
      return manifestChildUrl(origin, base, value, query);
    } catch {
      return value;
    }
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return line;
      const withAttributes = line.replace(
        /URI="([^"]+)"/gi,
        (_match, value: string) => `URI="${rewrite(value)}"`,
      );
      if (withAttributes.trimStart().startsWith("#")) return withAttributes;
      if (withAttributes.includes("<BaseURL>")) {
        return withAttributes.replace(
          /(<BaseURL>)([^<]+)(<\/BaseURL>)/i,
          (_match, start: string, value: string, end: string) => `${start}${rewrite(value)}${end}`,
        );
      }
      if (withAttributes.trimStart().startsWith("<")) {
        return withAttributes.replace(
          /(media|initialization|sourceURL)="([^"]+)"/gi,
          (_match, name: string, value: string) => `${name}="${rewrite(value)}"`,
        );
      }
      return rewrite(withAttributes.trim());
    })
    .join("\n");
}

function optionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : undefined;
}

function safeProviderHeaders(headers: Record<string, string> | undefined): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (BLOCKED_UPSTREAM_HEADERS.has(name.toLowerCase())) continue;
    result.set(name, value);
  }

  return result;
}

function isVideoLikeContentType(value: string | null): boolean {
  if (!value) return true;

  const type = value.split(";")[0]?.trim().toLowerCase();
  return (
    type.startsWith("video/") ||
    type === "application/octet-stream" ||
    type === "binary/octet-stream"
  );
}

function proxyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex",
  });

  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

async function fetchSafeUpstream(
  initialUrl: string,
  init: {
    method: "GET" | "HEAD";
    headers: Headers;
    signal: AbortSignal;
  },
): Promise<Response> {
  let current = assertSafeUrl(initialUrl);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      method: init.method,
      headers: init.headers,
      redirect: "manual",
      cache: "no-store",
      signal: init.signal,
    });

    if (response.status < 300 || response.status >= 400) return response;
    if (redirect === MAX_REDIRECTS) throw new Error("Too many playback redirects");

    const location = response.headers.get("location");
    if (!location) throw new Error("Playback redirect is missing a location");

    current = assertSafeUrl(new URL(location, current).href);
  }

  throw new Error("Playback redirect failed");
}

function upstreamFailure(status: number): Response {
  const clientStatus = status === 404 || status === 416 ? status : 502;

  return Response.json(
    {
      error:
        status === 404
          ? "Playback media was not found"
          : status === 416
            ? "Requested playback range is unavailable"
            : "Playback upstream rejected the media request",
    },
    {
      status: clientStatus,
      headers: {
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-pinflix-upstream-status": String(status),
        "x-pinflix-playback-error": "upstream-rejected",
      },
    },
  );
}

async function proxy(request: Request, headOnly: boolean): Promise<Response> {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const providerId = searchParams.get("provider") ?? "";
  const id = searchParams.get("id") ?? "";
  const slug = searchParams.get("slug") ?? undefined;
  const sourceIndex = Number(searchParams.get("source"));
  const target = searchParams.get("target");

  if (
    !providerId ||
    !id ||
    providerId.length > 64 ||
    id.length > 256 ||
    (slug && slug.length > 512) ||
    !Number.isInteger(sourceIndex) ||
    sourceIndex < 0 ||
    sourceIndex > 50
  ) {
    return Response.json(
      { error: "provider, id and a valid source index are required" },
      { status: 400 },
    );
  }

  try {
    const provider = getPlaybackProvider(providerId);
    const result = await provider.resolve({
      id,
      slug,
      season: optionalInteger(searchParams.get("season")),
      episode: optionalInteger(searchParams.get("episode")),
    });

    const source = result.sources[sourceIndex];

    if (!source) {
      return Response.json({ error: "Playback source not found" }, { status: 404 });
    }

    const hasProviderHeaders = source.headers && Object.keys(source.headers).length > 0;

    if (!target && !hasProviderHeaders && providerId !== "moviebox") {
      return Response.redirect(assertSafeUrl(source.url).href, 307);
    }

    const upstreamHeaders = safeProviderHeaders(source.headers);

    if (providerId === "moviebox") {
      if (!upstreamHeaders.has("user-agent")) {
        upstreamHeaders.set(
          "user-agent",
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/148 Mobile Safari/537.36",
        );
      }
      if (!upstreamHeaders.has("referer")) {
        upstreamHeaders.set("referer", "https://moviebox.ph/");
      }
      if (!upstreamHeaders.has("accept")) {
        upstreamHeaders.set("accept", "video/mp4,video/*;q=0.9,*/*;q=0.8");
      }
    }
    const upstreamTarget = target ? assertSafeUrl(target) : assertSafeUrl(source.url);
    if (target && upstreamTarget.hostname !== new URL(source.url).hostname) {
      return Response.json({ error: "Playback target is not allowed" }, { status: 400 });
    }

    const range = request.headers.get("range");
    const ifRange = request.headers.get("if-range");

    upstreamHeaders.set("accept-encoding", "identity");
    if (range) upstreamHeaders.set("range", range);
    if (ifRange) upstreamHeaders.set("if-range", ifRange);

    const upstream = await fetchSafeUpstream(upstreamTarget.href, {
      method: headOnly ? "HEAD" : "GET",
      headers: upstreamHeaders,
      signal: request.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      const sourceUrl = new URL(source.url);
      console.warn("[playback.proxy] upstream rejected media request", {
        status: upstream.status,
        providerId,
        sourceIndex,
        protocol: source.protocol,
        hostname: sourceUrl.hostname,
        sourceScheme: sourceUrl.protocol,
        upgrade: upstream.headers.get("upgrade"),
        server: upstream.headers.get("server"),
        contentType: upstream.headers.get("content-type"),
        hasRange: Boolean(range),
        hasProviderHeaders: Boolean(hasProviderHeaders),
      });
      return upstreamFailure(upstream.status);
    }

    if (
      source.protocol !== "mp4" &&
      isManifestContentType(upstream.headers.get("content-type"), upstreamTarget.href)
    ) {
      if (headOnly) {
        return new Response(null, {
          status: upstream.status,
          headers: proxyResponseHeaders(upstream),
        });
      }

      const manifest = await upstream.text();
      const rewritten = rewriteManifest(
        manifest,
        upstreamTarget.href,
        requestUrl.origin,
        searchParams,
      );
      const headers = proxyResponseHeaders(upstream);
      headers.set(
        "content-type",
        upstream.headers.get("content-type") ??
          (source.protocol === "hls" ? "application/vnd.apple.mpegurl" : "application/dash+xml"),
      );
      headers.delete("content-length");
      return new Response(rewritten, {
        status: upstream.status,
        headers,
      });
    }

    if (source.protocol !== "mp4") {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: proxyResponseHeaders(upstream),
      });
    }

    if (!isVideoLikeContentType(upstream.headers.get("content-type"))) {
      console.error("[playback.proxy] rejected non-video upstream response", {
        status: upstream.status,
        contentType: upstream.headers.get("content-type"),
        providerId,
      });

      return Response.json(
        { error: "Playback upstream returned an invalid media response" },
        {
          status: 502,
          headers: { "cache-control": "private, no-store" },
        },
      );
    }

    return new Response(headOnly ? null : upstream.body, {
      status: upstream.status,
      headers: proxyResponseHeaders(upstream),
    });
  } catch (error: unknown) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    console.error("[playback.proxy] failed", error);
    return Response.json(
      { error: "Unable to proxy playback" },
      {
        status: 502,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
}

export async function GET(request: Request) {
  return proxy(request, false);
}

export async function HEAD(request: Request) {
  return proxy(request, true);
}

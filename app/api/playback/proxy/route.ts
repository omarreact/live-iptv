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

const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
] as const;

function optionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function safeProviderHeaders(
  headers: Record<string, string> | undefined,
): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (BLOCKED_UPSTREAM_HEADERS.has(name.toLowerCase())) continue;
    result.set(name, value);
  }

  return result;
}

async function proxy(request: Request, headOnly: boolean): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("provider") ?? "";
  const id = searchParams.get("id") ?? "";
  const slug = searchParams.get("slug") ?? undefined;
  const sourceIndex = Number(searchParams.get("source"));

  if (
    !providerId ||
    !id ||
    !Number.isInteger(sourceIndex) ||
    sourceIndex < 0
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

    if (source.protocol !== "mp4") {
      return Response.json(
        {
          error:
            "Adaptive HLS/DASH sources require a segment-aware media gateway",
        },
        { status: 422 },
      );
    }

    if (!source.headers || Object.keys(source.headers).length === 0) {
      return Response.redirect(source.url, 307);
    }

    const upstreamHeaders = safeProviderHeaders(source.headers);
    const range = request.headers.get("range");
    const ifRange = request.headers.get("if-range");

    if (range) upstreamHeaders.set("range", range);
    if (ifRange) upstreamHeaders.set("if-range", ifRange);

    const upstream = await fetch(source.url, {
      method: headOnly ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "follow",
      cache: "no-store",
      signal: request.signal,
    });

    const responseHeaders = new Headers({
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });

    for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(headOnly ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error("[playback.proxy] failed", error);
    return Response.json({ error: "Unable to proxy playback" }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return proxy(request, false);
}

export async function HEAD(request: Request) {
  return proxy(request, true);
}

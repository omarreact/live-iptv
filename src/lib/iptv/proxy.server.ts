import { getChannel } from "./catalog.server";

const MAX_REDIRECTS = 5;
const MAX_CHILD_URL = 4096;
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

function assertPublicHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
  if (isPrivateHost(url.hostname)) throw new Error("Blocked host");
  return url;
}

function proxyScopeAllows(root: URL, child: URL): boolean {
  const rootHost = root.hostname.toLowerCase();
  const childHost = child.hostname.toLowerCase();
  return childHost === rootHost || childHost.endsWith("." + rootHost);
}

async function fetchUpstream(target: URL, request: Request): Promise<{ response: Response; finalUrl: URL }> {
  let current = target;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const headers = new Headers({
      accept: "*/*",
      "user-agent": DEFAULT_UA,
    });
    const range = request.headers.get("range");
    if (range) headers.set("range", range);

    const response = await fetch(current, {
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(18000),
    });

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current };
    }

    if (redirect === MAX_REDIRECTS) throw new Error("Too many redirects");
    const location = response.headers.get("location");
    if (!location) throw new Error("Invalid redirect");
    current = assertPublicHttpUrl(new URL(location, current).href);
  }
  throw new Error("Redirect failure");
}

function looksLikePlaylist(url: URL, contentType: string): boolean {
  return (
    /\.m3u8?(?:$|[?#])/i.test(url.pathname + url.search) ||
    /mpegurl|x-mpegurl|apple\.mpegurl/i.test(contentType)
  );
}

function passthroughHeaders(response: Response): Headers {
  const headers = new Headers();
  headers.set("content-type", response.headers.get("content-type") || "application/octet-stream");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function rewritePlaylist(
  text: string,
  finalUrl: URL,
  rootUrl: URL,
  requestUrl: URL,
  channelId: string,
  sourceIndex: number,
): string {
  const toProxy = (raw: string): string => {
    try {
      const child = assertPublicHttpUrl(new URL(raw, finalUrl).href);
      if (!proxyScopeAllows(rootUrl, child)) return child.href;
      const params = new URLSearchParams({
        channel: channelId,
        source: String(sourceIndex),
        u: child.href,
      });
      return requestUrl.origin + "/api/stream?" + params.toString();
    } catch {
      return raw;
    }
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => 'URI="' + toProxy(uri) + '"');
      }
      return toProxy(trimmed);
    })
    .join("\n");
}

export async function proxyCatalogStream(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const channelId = requestUrl.searchParams.get("channel")?.trim() || "";
  const sourceIndex = Number(requestUrl.searchParams.get("source") || "0");

  if (!channelId || channelId.length > 180 || !Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex > 20) {
    return new Response("Invalid stream request", { status: 400 });
  }

  const channel = await getChannel(channelId);
  const source = channel?.sources[sourceIndex];
  if (!channel || !source) return new Response("Stream source not found", { status: 404 });

  let rootUrl: URL;
  let target: URL;
  try {
    rootUrl = assertPublicHttpUrl(source.url);
    const childRaw = requestUrl.searchParams.get("u");
    if (childRaw && childRaw.length > MAX_CHILD_URL) return new Response("URL too long", { status: 414 });
    target = childRaw ? assertPublicHttpUrl(childRaw) : rootUrl;
    if (childRaw && !proxyScopeAllows(rootUrl, target)) {
      return new Response("Child stream is outside the source scope", { status: 403 });
    }
  } catch {
    return new Response("Invalid upstream", { status: 403 });
  }

  let upstreamResult: { response: Response; finalUrl: URL };
  try {
    upstreamResult = await fetchUpstream(target, request);
  } catch {
    return new Response("Upstream unreachable", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }

  const { response, finalUrl } = upstreamResult;
  if (!response.ok && response.status !== 206) {
    return new Response("Upstream stream unavailable (" + String(response.status) + ")", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }

  const contentType = response.headers.get("content-type") || "";
  if (looksLikePlaylist(finalUrl, contentType)) {
    const text = await response.text();
    return new Response(
      rewritePlaylist(text, finalUrl, rootUrl, requestUrl, channelId, sourceIndex),
      {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }

  return new Response(response.body, {
    status: response.status,
    headers: passthroughHeaders(response),
  });
}

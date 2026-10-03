import { randomUUID } from "node:crypto";
import { getChannel } from "./catalog.server";

const MAX_REDIRECTS = 5;
const CHILD_TOKEN_TTL_MS = 10 * 60_000;
const MAX_CHILD_TOKENS = 20_000;
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";

type StreamContext = {
  channelId: string;
  sourceIndex: number;
  countryCode: string | null;
};

type ChildToken = StreamContext & {
  url: string;
  expiresAt: number;
};

const childTokens = new Map<string, ChildToken>();

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

function pruneChildTokens(): void {
  const now = Date.now();
  for (const [token, value] of childTokens) {
    if (value.expiresAt <= now) childTokens.delete(token);
  }

  if (childTokens.size <= MAX_CHILD_TOKENS) return;
  for (const token of childTokens.keys()) {
    childTokens.delete(token);
    if (childTokens.size <= Math.floor(MAX_CHILD_TOKENS * 0.9)) break;
  }
}

function issueChildToken(url: URL, context: StreamContext): string {
  if (childTokens.size >= MAX_CHILD_TOKENS) pruneChildTokens();
  const token = randomUUID();
  childTokens.set(token, {
    ...context,
    url: url.href,
    expiresAt: Date.now() + CHILD_TOKEN_TTL_MS,
  });
  return token;
}

function resolveChildToken(token: string): ChildToken | null {
  const value = childTokens.get(token);
  if (!value) return null;
  if (value.expiresAt <= Date.now()) {
    childTokens.delete(token);
    return null;
  }
  return value;
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
  requestUrl: URL,
  context: StreamContext,
): string {
  const toProxy = (raw: string): string => {
    try {
      const child = assertPublicHttpUrl(new URL(raw, finalUrl).href);
      const token = issueChildToken(child, context);
      return requestUrl.origin + "/api/stream?t=" + encodeURIComponent(token);
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
  const childToken = requestUrl.searchParams.get("t")?.trim() || "";

  let context: StreamContext;
  let target: URL;

  if (childToken) {
    const child = resolveChildToken(childToken);
    if (!child) {
      return new Response("Expired or invalid stream token", {
        status: 403,
        headers: { "cache-control": "no-store" },
      });
    }

    context = {
      channelId: child.channelId,
      sourceIndex: child.sourceIndex,
      countryCode: child.countryCode,
    };

    try {
      target = assertPublicHttpUrl(child.url);
    } catch {
      return new Response("Invalid upstream", { status: 403 });
    }
  } else {
    const channelId = requestUrl.searchParams.get("channel")?.trim() || "";
    const sourceIndex = Number(requestUrl.searchParams.get("source") || "0");
    const rawCountry = requestUrl.searchParams.get("country")?.trim().toUpperCase() || "";
    const countryCode = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;

    if (!channelId || channelId.length > 180 || !Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex > 20) {
      return new Response("Invalid stream request", { status: 400 });
    }

    if (requestUrl.searchParams.has("u")) {
      return new Response("Direct child URLs are not accepted", { status: 403 });
    }

    const channel = await getChannel(channelId, countryCode);
    const source = channel?.sources[sourceIndex];
    if (!channel || !source) return new Response("Stream source not found", { status: 404 });

    context = { channelId, sourceIndex, countryCode };

    try {
      target = assertPublicHttpUrl(source.url);
    } catch {
      return new Response("Invalid upstream", { status: 403 });
    }
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
    return new Response(rewritePlaylist(text, finalUrl, requestUrl, context), {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: passthroughHeaders(response),
  });
}

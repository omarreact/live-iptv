import { recordStreamFailure, recordStreamSuccess } from "./health";
import { getIptvCatalog } from "./provider/iptv-org";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MAX_UA = 400;
const MAX_REDIRECTS = 6;
const MAX_URL_LENGTH = 4_096;
const ALLOWED_HOSTS_TTL_MS = 60 * 60_000;

let allowedHostsCache: { expiresAt: number; hosts: Set<string> } | null = null;

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.endsWith(".home.arpa") ||
    h === "metadata.google.internal"
  )
    return true;

  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    const d = Number(m[4]);
    if ([a, b, c, d].some((n) => n < 0 || n > 255)) return true;
    if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  if (
    h.startsWith("fe80:") ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h === "::" ||
    h === "::1"
  )
    return true;
  return false;
}

export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid stream URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Unsupported protocol");
  if (isPrivateHostname(url.hostname)) throw new Error("Blocked host");
  return url;
}

async function getAllowedHosts(): Promise<Set<string>> {
  if (allowedHostsCache && allowedHostsCache.expiresAt > Date.now()) {
    return allowedHostsCache.hosts;
  }

  const catalog = await getIptvCatalog();
  const hosts = new Set<string>();
  for (const channel of catalog.channels) {
    for (const stream of channel.streams) {
      try {
        const url = assertSafeUrl(stream.url);
        hosts.add(url.hostname.toLowerCase());
      } catch {
        /* ignore invalid catalog entries */
      }
    }
  }

  allowedHostsCache = {
    expiresAt: Date.now() + ALLOWED_HOSTS_TTL_MS,
    hosts,
  };
  return hosts;
}

async function assertCatalogHost(url: URL): Promise<void> {
  const hosts = await getAllowedHosts();
  if (!hosts.has(url.hostname.toLowerCase()))
    throw new Error("Stream host is not in the IPTV catalog");
}

type ProxyExtras = { ua: string; referrer: string | null };

function extrasFromRequest(incoming: URL): ProxyExtras {
  const uaRaw = incoming.searchParams.get("ua");
  const r = incoming.searchParams.get("r");
  let referrer: string | null = null;
  if (r) {
    try {
      const u = new URL(r);
      if ((u.protocol === "http:" || u.protocol === "https:") && !isPrivateHostname(u.hostname))
        referrer = u.href;
    } catch {
      /* ignore invalid referrer */
    }
  }
  return { ua: uaRaw && uaRaw.length > 0 && uaRaw.length <= MAX_UA ? uaRaw : UA, referrer };
}

function proxyUrl(origin: string, target: string, extras: ProxyExtras): string {
  const p = new URLSearchParams({ u: target });
  if (extras.ua !== UA) p.set("ua", extras.ua);
  if (extras.referrer) p.set("r", extras.referrer);
  return `${origin}/api/stream?${p.toString()}`;
}

function rewriteM3u8(
  text: string,
  base: string,
  origin: string,
  extras: ProxyExtras,
  allowedHosts: Set<string>,
): string {
  const rewriteChild = (raw: string): string => {
    try {
      const child = assertSafeUrl(new URL(raw, base).href);
      return allowedHosts.has(child.hostname.toLowerCase())
        ? proxyUrl(origin, child.href, extras)
        : child.href;
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
        return line.replace(
          /URI="([^"]+)"/gi,
          (_, uri: string) => `URI="${rewriteChild(uri)}"`,
        );
      }
      return rewriteChild(trimmed);
    })
    .join("\n");
}

function isPlaylistPath(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return path.endsWith(".m3u8") || path.endsWith(".m3u") || path.endsWith(".smil");
}

function passthroughHeaders(
  upstream: Response,
  fallbackType?: string,
  finalUrl?: URL,
): Headers {
  const out = new Headers();
  out.set(
    "content-type",
    upstream.headers.get("content-type") || fallbackType || "application/octet-stream",
  );
  out.set("cache-control", "no-store");
  out.set(
    "access-control-expose-headers",
    "Content-Length, Content-Range, Accept-Ranges, X-Pinflix-Upstream-Status",
  );
  out.set("x-accel-buffering", "no");
  out.set("x-pinflix-upstream-status", String(upstream.status));
  void finalUrl;
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

type UpstreamResult = {
  response: Response;
  finalUrl: URL;
};

async function fetchUpstream(
  target: URL,
  request: Request,
  extras: ProxyExtras,
): Promise<UpstreamResult> {
  let current = target;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    // The initial URL is catalog-approved before this function is called.
    // Redirect destinations are trusted only as a chain from that approved URL,
    // and are still blocked from private/internal network targets.
    const headers = new Headers({ "user-agent": extras.ua, accept: "*/*" });
    const range = request.headers.get("range");
    if (range) headers.set("range", range);
    if (extras.referrer) {
      headers.set("referer", extras.referrer);
      headers.set("origin", new URL(extras.referrer).origin);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    let upstream: Response;
    try {
      upstream = await fetch(current, {
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status < 300 || upstream.status >= 400) {
      return { response: upstream, finalUrl: current };
    }

    if (redirect === MAX_REDIRECTS) throw new Error("Too many upstream redirects");
    const location = upstream.headers.get("location");
    if (!location) throw new Error("Invalid upstream redirect");
    current = assertSafeUrl(new URL(location, current).href);
  }

  throw new Error("Upstream redirect failed");
}

export async function proxyStream(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const raw = incoming.searchParams.get("u");
  if (!raw) return new Response("Missing url", { status: 400 });
  if (raw.length > MAX_URL_LENGTH) return new Response("URL is too long", { status: 414 });

  let target: URL;
  try {
    target = assertSafeUrl(raw);
    await assertCatalogHost(target);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Bad url", { status: 403 });
  }

  const extras = extrasFromRequest(incoming);
  const startedAt = Date.now();
  let result: UpstreamResult;
  try {
    result = await fetchUpstream(target, request, extras);
  } catch (err) {
    recordStreamFailure(target.href, Date.now() - startedAt);
    return new Response(err instanceof Error ? err.message : "Upstream unreachable", {
      status: 502,
      headers: {
        "cache-control": "no-store",
      },
    });
  }

  const { response: upstream, finalUrl } = result;

  if (!upstream.ok && upstream.status !== 206) {
    recordStreamFailure(target.href, Date.now() - startedAt);
    const headers = passthroughHeaders(upstream, "text/plain; charset=utf-8", finalUrl);
    // Surface gateway failure as 502 so the client can distinguish a broken
    // upstream stream from a missing Pinflix API route.
    return new Response(`Upstream stream unavailable (${upstream.status})`, {
      status: 502,
      headers,
    });
  }

  recordStreamSuccess(target.href, Date.now() - startedAt);

  const contentType = upstream.headers.get("content-type") ?? "";
  const origin = incoming.origin;
  const treatAsPlaylist =
    isPlaylistPath(finalUrl) ||
    isPlaylistPath(target) ||
    /mpegurl|x-mpegurl|apple\.mpegurl|vnd\.apple/i.test(contentType);

  if (treatAsPlaylist) {
    const text = await upstream.text();
    // Relative HLS URLs must resolve from the final URL after redirects.
    const allowedHosts = await getAllowedHosts();
    const rewritten = rewriteM3u8(
      text,
      finalUrl.href,
      origin,
      extras,
      allowedHosts,
    );
    return new Response(rewritten, {
      status: 200,
      headers: passthroughHeaders(upstream, "application/vnd.apple.mpegurl", finalUrl),
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthroughHeaders(upstream, undefined, finalUrl),
  });
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const MAX_UA = 400;

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h === "metadata.google.internal"
  ) {
    return true;
  }
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid stream URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Blocked host");
  }
  return url;
}

type ProxyExtras = { ua: string; referrer: string | null };

function extrasFromRequest(incoming: URL): ProxyExtras {
  const uaRaw = incoming.searchParams.get("ua");
  const r = incoming.searchParams.get("r");
  let referrer: string | null = null;
  if (r) {
    try {
      const u = new URL(r);
      if ((u.protocol === "http:" || u.protocol === "https:") && !isPrivateHostname(u.hostname)) {
        referrer = u.href;
      }
    } catch {
      referrer = null;
    }
  }
  return {
    ua: uaRaw && uaRaw.length > 0 && uaRaw.length <= MAX_UA ? uaRaw : UA,
    referrer,
  };
}

function proxyUrl(origin: string, target: string, extras: ProxyExtras): string {
  const p = new URLSearchParams({ u: target });
  if (extras.ua && extras.ua !== UA) p.set("ua", extras.ua);
  if (extras.referrer) p.set("r", extras.referrer);
  return `${origin}/api/stream?${p.toString()}`;
}

function rewriteM3u8(text: string, base: string, origin: string, extras: ProxyExtras): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            const abs = new URL(uri, base).href;
            return `URI="${proxyUrl(origin, abs, extras)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        const abs = new URL(trimmed, base).href;
        return proxyUrl(origin, abs, extras);
      } catch {
        return line;
      }
    })
    .join("\n");
}

function isPlaylistPath(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return path.endsWith(".m3u8") || path.endsWith(".m3u") || path.endsWith(".smil");
}

function passthroughHeaders(upstream: Response, fallbackType?: string): Headers {
  const out = new Headers();
  out.set("content-type", upstream.headers.get("content-type") || fallbackType || "application/octet-stream");
  out.set("cache-control", "no-store");
  out.set("access-control-allow-origin", "*");
  out.set("x-accel-buffering", "no");
  const len = upstream.headers.get("content-length");
  if (len) out.set("content-length", len);
  const cr = upstream.headers.get("content-range");
  if (cr) out.set("content-range", cr);
  const ar = upstream.headers.get("accept-ranges");
  if (ar) out.set("accept-ranges", ar);
  return out;
}

async function fetchUpstream(target: URL, request: Request, extras: ProxyExtras): Promise<Response> {
  const headers = new Headers();
  headers.set("user-agent", extras.ua);
  headers.set("accept", "*/*");
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  if (extras.referrer) {
    headers.set("referer", extras.referrer);
    try {
      headers.set("origin", new URL(extras.referrer).origin);
    } catch {
      headers.set("origin", `${target.protocol}//${target.host}`);
    }
  } else {
    headers.set("referer", `${target.protocol}//${target.host}/`);
    headers.set("origin", `${target.protocol}//${target.host}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const upstream = await fetch(target, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    return upstream;
  } finally {
    clearTimeout(timer);
  }
}

export async function proxyStream(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const raw = incoming.searchParams.get("u");
  if (!raw) return new Response("Missing url", { status: 400 });

  let target: URL;
  try {
    target = assertSafeUrl(raw);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Bad url", { status: 400 });
  }

  const extras = extrasFromRequest(incoming);

  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, request, extras);
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const origin = incoming.origin;
  const treatAsPlaylist =
    isPlaylistPath(target) || /mpegurl|x-mpegurl|apple\.mpegurl|vnd\.apple/i.test(contentType);

  if (treatAsPlaylist) {
    const text = await upstream.text();
    const rewritten = rewriteM3u8(text, target.href, origin, extras);
    return new Response(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthroughHeaders(upstream),
  });
}

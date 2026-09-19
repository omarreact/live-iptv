import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const PLAYER_BASE = new URL(process.env.IPTV_PLAYER_BASE || "http://172.16.14.1");
const PUBLIC_BASE = process.env.BRIDGE_PUBLIC_URL ? new URL(process.env.BRIDGE_PUBLIC_URL) : null;
const SECRET = process.env.BRIDGE_SECRET?.trim() || "";
const TOKEN_KEY = process.env.BRIDGE_TOKEN_KEY?.trim() || SECRET;
const ALLOWED_STREAM_IDS = new Set(
  (process.env.ALLOWED_STREAM_IDS || "105")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!SECRET || SECRET.length < 24) throw new Error("BRIDGE_SECRET must be at least 24 characters");
if (!TOKEN_KEY || TOKEN_KEY.length < 24) throw new Error("BRIDGE_TOKEN_KEY must be at least 24 characters");

const resolverCache = new Map();
const allowedHosts = new Map();

function authorized(req) {
  return req.headers.authorization === `Bearer ${SECRET}`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "cache-control": "no-store", ...headers });
  res.end(body);
}

function isAllowedStreamId(id) {
  return /^[0-9]{1,6}$/.test(id) && ALLOWED_STREAM_IDS.has(id);
}

function key() {
  return createHash("sha256").update(TOKEN_KEY).digest();
}

function seal(streamId, target) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(
      Buffer.from(
        JSON.stringify({ s: streamId, u: target, e: Date.now() + 60 * 60_000 }),
        "utf8",
      ),
    ),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function open(token) {
  const [ivRaw, tagRaw, bodyRaw] = token.split(".");
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("invalid token");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decoded = Buffer.concat([
    decipher.update(Buffer.from(bodyRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const payload = JSON.parse(decoded);
  if (
    typeof payload.s !== "string" ||
    typeof payload.u !== "string" ||
    typeof payload.e !== "number" ||
    payload.e < Date.now()
  ) throw new Error("expired token");
  return payload;
}

function resolveChild(raw, base) {
  const child = new URL(raw, base);
  const parent = new URL(base);
  for (const [name, value] of parent.searchParams) {
    if (!child.searchParams.has(name)) child.searchParams.set(name, value);
  }
  return child;
}

function requestOrigin(req) {
  if (PUBLIC_BASE) return PUBLIC_BASE.origin;
  const proto = req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
}

function rewritePlaylist(text, base, streamId, origin) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri) => {
          try {
            const target = resolveChild(uri, base).href;
            return `URI="${origin}/v1/fetch?pt=${encodeURIComponent(seal(streamId, target))}"`;
          } catch {
            return 'URI=""';
          }
        });
      }
      try {
        const target = resolveChild(trimmed, base).href;
        return `${origin}/v1/fetch?pt=${encodeURIComponent(seal(streamId, target))}`;
      } catch {
        return "";
      }
    })
    .join("\n");
}

async function resolvePlayer(streamId) {
  const cached = resolverCache.get(streamId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const playerUrl = new URL("/player.php", PLAYER_BASE);
  playerUrl.searchParams.set("stream", streamId);
  const response = await fetch(playerUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 PinflixBridge/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`player resolver failed: ${response.status}`);

  const html = await response.text();
  const match = html.match(/primarySource\s*=\s*['"]([^'"]+)['"]/i);
  if (!match?.[1]) throw new Error("primarySource not found");

  const source = new URL(match[1], PLAYER_BASE);
  if (source.protocol !== "http:" && source.protocol !== "https:") throw new Error("unsupported source protocol");

  allowedHosts.set(streamId, source.hostname.toLowerCase());
  resolverCache.set(streamId, { url: source.href, expiresAt: Date.now() + 5 * 60_000 });
  return source.href;
}

async function assertTargetAllowed(streamId, target) {
  if (!isAllowedStreamId(streamId)) throw new Error("stream not allowed");
  let host = allowedHosts.get(streamId);
  if (!host) host = new URL(await resolvePlayer(streamId)).hostname.toLowerCase();
  if (target.hostname.toLowerCase() !== host) throw new Error("target host is not authorized");
}

async function fetchUpstream(target, req) {
  const headers = new Headers({ accept: "*/*", "user-agent": "Mozilla/5.0 PinflixBridge/1.0" });
  if (req.headers.range) headers.set("range", req.headers.range);
  return fetch(target, {
    headers,
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(18_000),
  });
}

function copyResponseHeaders(upstream) {
  const headers = {
    "content-type": upstream.headers.get("content-type") || "application/octet-stream",
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  };
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

function looksLikePlaylist(url, contentType) {
  return /\.m3u8?(?:$|\?)/i.test(url.href) ||
    /mpegurl|x-mpegurl|apple\.mpegurl|vnd\.apple/i.test(contentType || "");
}

async function proxyTarget(streamId, target, req, res) {
  await assertTargetAllowed(streamId, target);
  const upstream = await fetchUpstream(target, req);
  if (!upstream.ok && upstream.status !== 206) {
    send(res, 502, "upstream unavailable");
    return;
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (looksLikePlaylist(target, contentType)) {
    const text = await upstream.text();
    send(res, 200, rewritePlaylist(text, target.href, streamId, requestOrigin(req)), {
      "content-type": "application/vnd.apple.mpegurl",
    });
    return;
  }

  res.writeHead(upstream.status, copyResponseHeaders(upstream));
  if (!upstream.body) return res.end();
  for await (const chunk of upstream.body) res.write(chunk);
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = requestOrigin(req);
    const url = new URL(req.url || "/", origin);

    if (url.pathname === "/health") {
      send(res, 200, JSON.stringify({ ok: true }), { "content-type": "application/json" });
      return;
    }
    if (!authorized(req)) return send(res, 401, "unauthorized");

    const match = url.pathname.match(/^\/v1\/channel\/(\d+)\/master\.m3u8$/);
    if (match) {
      const streamId = match[1];
      if (!streamId || !isAllowedStreamId(streamId)) return send(res, 404, "channel not found");
      await proxyTarget(streamId, new URL(await resolvePlayer(streamId)), req, res);
      return;
    }

    if (url.pathname === "/v1/fetch") {
      const token = url.searchParams.get("pt");
      if (!token || token.length > 16_000) return send(res, 400, "missing token");
      const payload = open(token);
      if (!isAllowedStreamId(payload.s)) return send(res, 403, "stream not allowed");
      await proxyTarget(payload.s, new URL(payload.u), req, res);
      return;
    }

    send(res, 404, "not found");
  } catch (error) {
    console.error("[pinflix-bridge]", error instanceof Error ? error.message : error);
    send(res, 502, "This channel is temporarily unavailable");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pinflix IPTV Bridge listening on :${PORT}`);
});

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { browseWithAdapter, resolveWithAdapter } from "./provider-adapters.mjs";

const SECRET = process.env.BRIDGE_SECRET?.trim() || "";
const TOKEN_KEY =
  process.env.BRIDGE_MEDIA_TOKEN_KEY?.trim() ||
  process.env.BRIDGE_TOKEN_KEY?.trim() ||
  SECRET;
const APP_ORIGIN = process.env.PINFLIX_APP_ORIGIN?.trim() || "*";
const FFMPEG_PATH = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const FFMPEG_VIDEO_CODEC = process.env.FFMPEG_VIDEO_CODEC?.trim() || "libx264";
const FFMPEG_PRESET = process.env.FFMPEG_PRESET?.trim() || "veryfast";
const MEDIA_TOKEN_TTL_MS = 6 * 60 * 60_000;
const MAX_TOKEN_LENGTH = 16_000;
const MAX_REDIRECTS = 4;
const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "m4v",
  "webm",
  "ogg",
  "ogv",
  "mkv",
  "avi",
  "mov",
  "ts",
  "m2ts",
  "mts",
  "mpg",
  "mpeg",
  "wmv",
  "flv",
  "m3u8",
  "m3u",
]);
const STATIC_EXTENSIONS = new Set([
  "css",
  "js",
  "json",
  "xml",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "ico",
  "woff",
  "woff2",
  "ttf",
]);

if (!SECRET || SECRET.length < 24) throw new Error("BRIDGE_SECRET must be at least 24 characters");
if (!TOKEN_KEY || TOKEN_KEY.length < 24) {
  throw new Error("BRIDGE_MEDIA_TOKEN_KEY/BRIDGE_TOKEN_KEY must be at least 24 characters");
}

function parseSources() {
  const raw = process.env.MEDIA_SOURCES_JSON?.trim();
  if (!raw) return new Map();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MEDIA_SOURCES_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("MEDIA_SOURCES_JSON must be a JSON array");

  const map = new Map();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || "").trim();
    const name = String(item.name || "").trim();
    const baseUrl = String(item.baseUrl || "").trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,31}$/i.test(id) || !name || !baseUrl) continue;

    const base = new URL(baseUrl);
    if (base.protocol !== "http:" && base.protocol !== "https:") continue;
    if (!base.pathname.endsWith("/")) base.pathname += "/";

    const headers = new Headers();
    if (item.headers && typeof item.headers === "object") {
      for (const [key, value] of Object.entries(item.headers)) {
        if (typeof value === "string" && key && value) headers.set(key, value);
      }
    }

    const requestedAdapter = typeof item.adapter === "string" ? item.adapter.trim() : "html";
    const adapter = ["html", "dhakaflix-json", "cineplexbd"].includes(requestedAdapter)
      ? requestedAdapter
      : "html";

    map.set(id, {
      id,
      name,
      description: typeof item.description === "string" ? item.description.trim() : "",
      adapter,
      base,
      headers,
    });
  }
  return map;
}

const mediaSources = parseSources();

function authorized(req) {
  return req.headers.authorization === `Bearer ${SECRET}`;
}

function requestOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
}

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": APP_ORIGIN,
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "range,content-type",
    "access-control-expose-headers": "content-length,content-range,accept-ranges,content-type",
    vary: "Origin",
    ...extra,
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "cache-control": "no-store", ...headers });
  res.end(body);
}

function sendJson(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
}

function key() {
  return createHash("sha256").update(TOKEN_KEY).digest();
}

function sealMedia(sourceId, target, extraHeaders = {}) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const safeHeaders = {};
  for (const name of ["cookie", "referer"]) {
    const value = extraHeaders?.[name];
    if (typeof value === "string" && value && value.length <= 8_000) safeHeaders[name] = value;
  }
  const encrypted = Buffer.concat([
    cipher.update(
      Buffer.from(
        JSON.stringify({
          s: sourceId,
          u: target,
          h: safeHeaders,
          e: Date.now() + MEDIA_TOKEN_TTL_MS,
        }),
        "utf8",
      ),
    ),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function openMedia(token) {
  const [ivRaw, tagRaw, bodyRaw] = token.split(".");
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("invalid media token");
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
  ) {
    throw new Error("expired media token");
  }
  return payload;
}

function sourceById(id) {
  const source = mediaSources.get(id);
  if (!source) throw new Error("unknown media source");
  return source;
}

function assertAllowedTarget(source, target) {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("unsupported media protocol");
  }
  if (target.origin !== source.base.origin) throw new Error("media origin mismatch");
  if (!target.pathname.startsWith(source.base.pathname)) throw new Error("media path outside source root");
  return target;
}

function targetForPath(source, rawPath = "") {
  const normalized = String(rawPath || "").replace(/^\/+/, "");
  return assertAllowedTarget(source, new URL(normalized || "./", source.base));
}

function relativePath(source, target) {
  const pathname = target.pathname.startsWith(source.base.pathname)
    ? target.pathname.slice(source.base.pathname.length)
    : "";
  return `${pathname}${target.search || ""}`;
}

function extensionOf(url) {
  const name = decodeURIComponent(url.pathname.split("/").pop() || "");
  const match = name.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() || "";
}

function mimeForExtension(ext) {
  const map = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    ogv: "video/ogg",
    m3u8: "application/vnd.apple.mpegurl",
    m3u: "application/vnd.apple.mpegurl",
    ts: "video/mp2t",
    m2ts: "video/mp2t",
    mts: "video/mp2t",
    mkv: "video/x-matroska",
  };
  return map[ext] || "application/octet-stream";
}

function isDirectPlayable(ext) {
  return ["mp4", "m4v", "webm", "ogg", "ogv", "m3u8", "m3u"].includes(ext);
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(target, label) {
  const cleaned = decodeHtml(label || "");
  if (cleaned && cleaned !== ".." && cleaned.toLowerCase() !== "parent directory") return cleaned;
  const last = decodeURIComponent(target.pathname.replace(/\/$/, "").split("/").pop() || "");
  return last || "Untitled";
}

function parseLinks(source, html, pageUrl) {
  const entries = [];
  const seen = new Set();
  const regex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const rawHref = match[1]?.trim();
    if (!rawHref || rawHref.startsWith("#") || /^(?:javascript|mailto|tel):/i.test(rawHref)) continue;

    let target;
    try {
      target = assertAllowedTarget(source, new URL(rawHref, pageUrl));
    } catch {
      continue;
    }
    if (target.href === pageUrl.href || target.href === source.base.href) continue;

    const path = relativePath(source, target);
    if (!path || seen.has(path)) continue;
    seen.add(path);

    const ext = extensionOf(target);
    if (STATIC_EXTENSIONS.has(ext)) continue;
    const video = VIDEO_EXTENSIONS.has(ext);
    entries.push({
      id: createHash("sha1").update(`${source.id}:${path}`).digest("hex").slice(0, 16),
      type: video ? "video" : "directory",
      name: displayName(target, match[2] || ""),
      path,
      extension: ext || null,
      playable: video,
    });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
  return entries.slice(0, 1000);
}

async function fetchAllowed(source, initial, options = {}) {
  let current = assertAllowedTarget(source, new URL(initial));
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const headers = new Headers(source.headers);
    headers.set("accept", options.accept || "*/*");
    headers.set("user-agent", "Mozilla/5.0 PinflixMediaBridge/1.0");
    if (options.headers && typeof options.headers === "object") {
      for (const [name, value] of Object.entries(options.headers)) {
        if (typeof value === "string" && value) headers.set(name, value);
      }
    }
    if (options.range) headers.set("range", options.range);

    const response = await fetch(current, {
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeout || 18_000),
    });

    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current };
    if (redirect === MAX_REDIRECTS) throw new Error("too many media redirects");
    const location = response.headers.get("location");
    if (!location) throw new Error("invalid media redirect");
    current = assertAllowedTarget(source, new URL(location, current));
  }
  throw new Error("media redirect failed");
}

function playlistResponseUrl(origin, sourceId, target, extraHeaders = {}) {
  const url = new URL("/v1/media/file", origin);
  url.searchParams.set("mt", sealMedia(sourceId, target, extraHeaders));
  return url.href;
}

function rewritePlaylist(text, base, source, origin, extraHeaders = {}) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri) => {
          try {
            const target = assertAllowedTarget(source, new URL(uri, base));
            return `URI="${playlistResponseUrl(origin, source.id, target.href, extraHeaders)}"`;
          } catch {
            return 'URI=""';
          }
        });
      }
      try {
        const target = assertAllowedTarget(source, new URL(trimmed, base));
        return playlistResponseUrl(origin, source.id, target.href, extraHeaders);
      } catch {
        return "";
      }
    })
    .join("\n");
}

function responseHeaders(upstream, fallbackType) {
  const headers = corsHeaders({
    "content-type": upstream.headers.get("content-type") || fallbackType || "application/octet-stream",
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  });
  for (const name of ["content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

function ffmpegHeaders(source, extraHeaders = {}) {
  const merged = new Headers(source.headers);
  for (const [name, value] of Object.entries(extraHeaders || {})) {
    if (typeof value === "string" && value) merged.set(name, value);
  }
  const lines = [];
  for (const [name, value] of merged) lines.push(`${name}: ${value}`);
  return lines.length ? `${lines.join("\r\n")}\r\n` : "";
}

function transcode(source, target, req, res, extraHeaders = {}) {
  const args = ["-hide_banner", "-loglevel", "error"];
  const rawHeaders = ffmpegHeaders(source, extraHeaders);
  if (rawHeaders) args.push("-headers", rawHeaders);
  args.push(
    "-i",
    target.href,
    "-map",
    "0:v:0?",
    "-map",
    "0:a:0?",
    "-sn",
    "-c:v",
    FFMPEG_VIDEO_CODEC,
  );
  if (FFMPEG_VIDEO_CODEC !== "copy" && FFMPEG_PRESET) args.push("-preset", FFMPEG_PRESET);
  args.push("-c:a", "aac", "-b:a", "160k", "-f", "mpegts", "pipe:1");

  res.writeHead(200, corsHeaders({
    "content-type": "video/mp2t",
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  }));

  const child = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
  let closed = false;
  const stop = () => {
    if (closed) return;
    closed = true;
    child.kill("SIGKILL");
  };
  req.on("close", stop);
  res.on("close", stop);
  child.stdout.pipe(res);
  child.stderr.on("data", (chunk) => {
    const message = String(chunk || "").trim();
    if (message) console.error("[pinflix-media-ffmpeg]", message.slice(0, 500));
  });
  child.on("error", (error) => {
    console.error("[pinflix-media-ffmpeg]", error.message);
    if (!res.writableEnded) res.end();
  });
  child.on("exit", () => {
    closed = true;
    if (!res.writableEnded) res.end();
  });
}

async function listSources(req, res) {
  if (!authorized(req)) return send(res, 401, "unauthorized");
  sendJson(res, 200, {
    sources: [...mediaSources.values()].map((source) => ({
      id: source.id,
      name: source.name,
      description: source.description,
      adapter: source.adapter,
    })),
  });
}

async function browse(req, res, url) {
  if (!authorized(req)) return send(res, 401, "unauthorized");
  const source = sourceById(url.searchParams.get("source") || "");
  const requestedPath = url.searchParams.get("path") || "";

  const adapted = await browseWithAdapter(source, requestedPath);
  if (adapted) {
    return sendJson(res, 200, {
      source: { id: source.id, name: source.name, description: source.description },
      path: adapted.path,
      items: adapted.items,
    });
  }

  const target = targetForPath(source, requestedPath);
  const { response, finalUrl } = await fetchAllowed(source, target, {
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    timeout: 12_000,
  });
  if (!response.ok) throw new Error(`media catalog failed: ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  if (!/html|text\//i.test(contentType)) {
    const ext = extensionOf(finalUrl);
    const video = VIDEO_EXTENSIONS.has(ext);
    return sendJson(res, 200, {
      source: { id: source.id, name: source.name, description: source.description },
      path: relativePath(source, finalUrl),
      items: video
        ? [{
            id: createHash("sha1").update(finalUrl.href).digest("hex").slice(0, 16),
            type: "video",
            name: displayName(finalUrl, ""),
            path: relativePath(source, finalUrl),
            extension: ext || null,
            playable: true,
          }]
        : [],
    });
  }

  const html = await response.text();
  sendJson(res, 200, {
    source: { id: source.id, name: source.name, description: source.description },
    path: relativePath(source, finalUrl),
    items: parseLinks(source, html, finalUrl),
  });
}

async function resolve(req, res, url) {
  if (!authorized(req)) return send(res, 401, "unauthorized");
  const source = sourceById(url.searchParams.get("source") || "");
  const requestedPath = url.searchParams.get("path") || "";
  const adapted = await resolveWithAdapter(source, requestedPath);
  const target = adapted?.target ?? targetForPath(source, requestedPath);
  const extraHeaders = adapted?.headers ?? {};
  const ext = extensionOf(target);
  if (!VIDEO_EXTENSIONS.has(ext)) return send(res, 415, "unsupported media type");

  const token = sealMedia(source.id, target.href, extraHeaders);
  const origin = requestOrigin(req);
  const playback = new URL("/v1/media/file", origin);
  playback.searchParams.set("mt", token);
  const transcodeUrl = new URL(playback);
  transcodeUrl.searchParams.set("transcode", "1");

  sendJson(res, 200, {
    source: { id: source.id, name: source.name },
    title: displayName(target, ""),
    path: relativePath(source, target),
    kind: ext === "m3u8" || ext === "m3u" ? "hls" : "file",
    mimeType: mimeForExtension(ext),
    directPlayable: isDirectPlayable(ext),
    url: playback.href,
    transcodeUrl: transcodeUrl.href,
  });
}

async function file(req, res, url) {
  const token = url.searchParams.get("mt") || "";
  if (!token || token.length > MAX_TOKEN_LENGTH) return send(res, 400, "missing media token", corsHeaders());
  const payload = openMedia(token);
  const source = sourceById(payload.s);
  const target = assertAllowedTarget(source, new URL(payload.u));

  const extraHeaders =
    payload.h && typeof payload.h === "object" && !Array.isArray(payload.h)
      ? payload.h
      : {};

  if (url.searchParams.get("transcode") === "1") {
    transcode(source, target, req, res, extraHeaders);
    return;
  }

  const { response, finalUrl } = await fetchAllowed(source, target, {
    accept: "*/*",
    headers: extraHeaders,
    range: req.headers.range,
    timeout: 30_000,
  });
  if (!response.ok && response.status !== 206) {
    return send(res, 502, "media unavailable", corsHeaders());
  }

  const contentType = response.headers.get("content-type") || "";
  const ext = extensionOf(finalUrl);
  if (ext === "m3u8" || ext === "m3u" || /mpegurl|x-mpegurl|apple\.mpegurl|vnd\.apple/i.test(contentType)) {
    const text = await response.text();
    return send(
      res,
      200,
      rewritePlaylist(text, finalUrl.href, source, requestOrigin(req), extraHeaders),
      corsHeaders({
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
      }),
    );
  }

  res.writeHead(response.status, responseHeaders(response, mimeForExtension(ext)));
  if (!response.body) return res.end();
  for await (const chunk of response.body) res.write(chunk);
  res.end();
}

export async function handleMediaRequest(req, res, url) {
  if (!url.pathname.startsWith("/v1/media/")) return false;

  try {
    if (req.method === "OPTIONS") {
      send(res, 204, "", corsHeaders());
      return true;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "method not allowed", corsHeaders());
      return true;
    }

    if (url.pathname === "/v1/media/sources") await listSources(req, res);
    else if (url.pathname === "/v1/media/browse") await browse(req, res, url);
    else if (url.pathname === "/v1/media/resolve") await resolve(req, res, url);
    else if (url.pathname === "/v1/media/file") await file(req, res, url);
    else send(res, 404, "not found", corsHeaders());
  } catch (error) {
    console.error("[pinflix-media]", error instanceof Error ? error.message : error);
    if (!res.headersSent) send(res, 502, "Media source is temporarily unavailable", corsHeaders());
    else if (!res.writableEnded) res.end();
  }
  return true;
}

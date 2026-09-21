import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET = process.env.BRIDGE_SECRET?.trim() || "";
const TOKEN_KEY =
  process.env.BRIDGE_MEDIA_TOKEN_KEY?.trim() ||
  process.env.BRIDGE_TOKEN_KEY?.trim() ||
  SECRET;
const APP_ORIGIN = process.env.PINFLIX_APP_ORIGIN?.trim() || "*";
const PUBLIC_BASE = process.env.BRIDGE_PUBLIC_URL?.trim() || "";
const ENABLED = /^(?:1|true|yes)$/i.test(
  process.env.MOVIEBOX_BRIDGE_ENABLED?.trim() || "",
);
const API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const PLAYER_FALLBACK = "https://mzfi.me";
const MAX_REDIRECTS = 4;
const TOKEN_TTL_MS = 30 * 60_000;
const MAX_TOKEN_LENGTH = 20_000;

const PLAYER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  accept: "application/json",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "x-client-info": '{"timezone":"Asia/Dhaka"}',
  "x-source": "",
};

let cachedPlayerDomain = {
  value: PLAYER_FALLBACK,
  expiresAt: 0,
};

if (!SECRET || SECRET.length < 24) {
  throw new Error("BRIDGE_SECRET must be at least 24 characters");
}
if (!TOKEN_KEY || TOKEN_KEY.length < 24) {
  throw new Error(
    "BRIDGE_MEDIA_TOKEN_KEY/BRIDGE_TOKEN_KEY must be at least 24 characters",
  );
}

function authorized(req) {
  return req.headers.authorization === `Bearer ${SECRET}`;
}

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": APP_ORIGIN,
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "range,content-type",
    "access-control-expose-headers":
      "content-length,content-range,accept-ranges,content-type,x-pinflix-upstream-status",
    vary: "Origin",
    ...extra,
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
}

function requestOrigin(req) {
  if (PUBLIC_BASE) return new URL(PUBLIC_BASE).origin;
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.socket.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
}

function key() {
  return createHash("sha256").update(TOKEN_KEY).digest();
}

function signedUrlExpiry(url) {
  const raw = url.searchParams.get("t");
  if (!raw || !/^\d{9,}$/.test(raw)) return null;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) ? seconds * 1000 : null;
}

function tokenExpiry(target) {
  const signedExpiry = signedUrlExpiry(target);
  const normalExpiry = Date.now() + TOKEN_TTL_MS;
  return signedExpiry
    ? Math.max(Date.now() + 5_000, Math.min(normalExpiry, signedExpiry - 5_000))
    : normalExpiry;
}

function safeStoredHeaders(headers = {}) {
  const output = {};
  for (const name of ["cookie", "referer", "origin", "user-agent"]) {
    const value = headers[name] ?? headers[
      Object.keys(headers).find((key) => key.toLowerCase() === name) || ""
    ];
    if (typeof value === "string" && value && value.length <= 8_000) {
      output[name] = value;
    }
  }
  return output;
}

function seal(target, headers) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.from(
    JSON.stringify({
      u: target.href,
      h: safeStoredHeaders(headers),
      e: tokenExpiry(target),
    }),
    "utf8",
  );
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function open(token) {
  const [ivRaw, tagRaw, bodyRaw] = token.split(".");
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("invalid media token");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decoded = Buffer.concat([
    decipher.update(Buffer.from(bodyRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  const payload = JSON.parse(decoded);
  if (
    typeof payload.u !== "string" ||
    typeof payload.e !== "number" ||
    payload.e < Date.now()
  ) {
    throw new Error("expired media token");
  }

  return payload;
}

function allowedMediaTarget(raw) {
  const target = raw instanceof URL ? raw : new URL(raw);
  if (target.protocol !== "https:") throw new Error("unsupported media protocol");

  const host = target.hostname.toLowerCase();
  const allowed =
    host === "hakunaymatata.com" ||
    host.endsWith(".hakunaymatata.com") ||
    host === "aoneroom.com" ||
    host.endsWith(".aoneroom.com");

  if (!allowed) throw new Error("moviebox media host is not allowed");
  return target;
}

function firstString(record, keys) {
  for (const name of keys) {
    const value = record?.[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function resolutionOf(stream) {
  const raw = stream?.resolutions ?? stream?.resolution ?? stream?.quality;
  const value = Number(String(raw ?? "").match(/\d{3,4}/)?.[0] || raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function streamUrl(stream) {
  const raw = firstString(stream, [
    "url",
    "playUrl",
    "play_url",
    "streamUrl",
    "stream_url",
    "file",
    "src",
  ]);
  if (!raw) return null;

  try {
    return allowedMediaTarget(raw);
  } catch {
    return null;
  }
}

function streamHeaders(stream, playerReferer, playerDomain) {
  const output = {
    referer: playerReferer,
    origin: new URL(playerDomain).origin,
    "user-agent": PLAYER_HEADERS["user-agent"],
  };

  if (stream?.headers && typeof stream.headers === "object") {
    for (const [name, value] of Object.entries(stream.headers)) {
      if (typeof value === "string" && value) output[name] = value;
    }
  }

  const cookie = firstString(stream, ["signCookie", "sign_cookie", "cookie"]);
  if (cookie) output.cookie = cookie;
  return output;
}

async function playerDomain() {
  if (cachedPlayerDomain.expiresAt > Date.now()) return cachedPlayerDomain.value;

  try {
    const response = await fetch(`${API_BASE}/media-player/get-domain`, {
      headers: PLAYER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      const payload = await response.json();
      const raw =
        typeof payload?.data === "string" && payload.data.trim()
          ? payload.data.trim()
          : PLAYER_FALLBACK;
      const parsed = new URL(raw);
      if (parsed.protocol === "https:") {
        cachedPlayerDomain = {
          value: parsed.href.replace(/\/$/, ""),
          expiresAt: Date.now() + 5 * 60_000,
        };
      }
    }
  } catch {
    // Keep the last known/fallback domain.
  }

  return cachedPlayerDomain.value;
}

async function playData(id, slug, season, episode) {
  const domain = await playerDomain();
  const playerReferer =
    `${domain}/spa/videoPlayPage/movies/${encodeURIComponent(slug)}` +
    `?id=${encodeURIComponent(id)}&type=/movie/detail` +
    `&detailSe=${season}&detailEp=${episode}&lang=en`;

  const playUrl = new URL("/wefeed-h5api-bff/subject/play", domain);
  playUrl.searchParams.set("subjectId", id);
  playUrl.searchParams.set("se", String(season));
  playUrl.searchParams.set("ep", String(episode));
  playUrl.searchParams.set("detailPath", slug);
  playUrl.searchParams.set("_ts", String(Date.now()));

  const response = await fetch(playUrl, {
    headers: {
      ...PLAYER_HEADERS,
      referer: playerReferer,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`moviebox player returned ${response.status}`);
  }

  const payload = await response.json();
  return {
    data: payload?.data && typeof payload.data === "object" ? payload.data : {},
    domain,
    playerReferer,
  };
}

async function resolvedStreams(id, slug, season, episode) {
  let selectedSeason = season;
  let selectedEpisode = episode;
  let result = await playData(id, slug, selectedSeason, selectedEpisode);

  let streams = Array.isArray(result.data?.streams) ? result.data.streams : [];
  if (streams.length === 0 && selectedSeason !== 0) {
    const fallback = await playData(id, slug, 0, 1);
    const fallbackStreams = Array.isArray(fallback.data?.streams)
      ? fallback.data.streams
      : [];
    if (fallbackStreams.length > 0) {
      result = fallback;
      streams = fallbackStreams;
      selectedSeason = 0;
      selectedEpisode = 1;
    }
  }

  const maxResolution = Number(result.data?.playConfig?.maxResolution);
  const origin = result.domain;

  const normalized = streams.flatMap((stream) => {
    if (!stream || typeof stream !== "object") return [];
    const target = streamUrl(stream);
    if (!target) return [];

    const resolution = resolutionOf(stream);
    if (
      Number.isFinite(maxResolution) &&
      maxResolution > 0 &&
      resolution &&
      resolution > maxResolution
    ) {
      return [];
    }

    return [{
      target,
      quality: resolution ? `${resolution}P` : "MP4",
      headers: streamHeaders(stream, result.playerReferer, origin),
    }];
  });

  return {
    season: selectedSeason,
    episode: selectedEpisode,
    streams: normalized,
  };
}

async function resolve(req, res, url) {
  if (!ENABLED) return send(res, 404, "moviebox bridge disabled");
  if (!authorized(req)) return send(res, 401, "unauthorized");

  const id = (url.searchParams.get("id") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();
  const season = Number(url.searchParams.get("season") || "1");
  const episode = Number(url.searchParams.get("episode") || "1");

  if (
    !id ||
    !slug ||
    id.length > 256 ||
    slug.length > 512 ||
    !Number.isInteger(season) ||
    season < 0 ||
    season > 10_000 ||
    !Number.isInteger(episode) ||
    episode < 0 ||
    episode > 10_000
  ) {
    return send(res, 400, "invalid moviebox request");
  }

  const resolved = await resolvedStreams(id, slug, season, episode);
  const origin = requestOrigin(req);

  const sources = resolved.streams.map((stream) => {
    const playback = new URL("/v1/moviebox/file", origin);
    playback.searchParams.set("mt", seal(stream.target, stream.headers));
    return {
      url: playback.href,
      protocol: "mp4",
      quality: stream.quality,
      mimeType: "video/mp4",
    };
  });

  return sendJson(res, 200, {
    sources,
    season: resolved.season,
    episode: resolved.episode,
  });
}

async function fetchMedia(target, req, storedHeaders) {
  let current = allowedMediaTarget(target);
  const method = req.method === "HEAD" ? "HEAD" : "GET";

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const headers = new Headers(storedHeaders || {});
    headers.set("accept", req.headers.accept || "video/mp4,video/*;q=0.9,*/*;q=0.8");
    headers.set("accept-encoding", "identity");
    if (req.headers.range) headers.set("range", req.headers.range);
    if (req.headers["if-range"]) headers.set("if-range", req.headers["if-range"]);

    const response = await fetch(current, {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status < 300 || response.status >= 400) return response;
    if (redirect === MAX_REDIRECTS) throw new Error("too many media redirects");

    const location = response.headers.get("location");
    if (!location) throw new Error("invalid media redirect");
    current = allowedMediaTarget(new URL(location, current));
  }

  throw new Error("media redirect failed");
}

function copyMediaHeaders(upstream) {
  const headers = corsHeaders({
    "content-type": upstream.headers.get("content-type") || "video/mp4",
    "cache-control": "private, no-store",
    "x-accel-buffering": "no",
  });

  for (const name of [
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

async function file(req, res, url) {
  if (!ENABLED) return send(res, 404, "moviebox bridge disabled", corsHeaders());

  const token = url.searchParams.get("mt") || "";
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return send(res, 400, "missing media token", corsHeaders());
  }

  const payload = open(token);
  const target = allowedMediaTarget(payload.u);
  const upstream = await fetchMedia(target, req, payload.h);

  if (!upstream.ok && upstream.status !== 206) {
    return send(res, 502, "media unavailable", corsHeaders({
      "x-pinflix-upstream-status": String(upstream.status),
    }));
  }

  res.writeHead(upstream.status, copyMediaHeaders(upstream));
  if (req.method === "HEAD" || !upstream.body) return res.end();
  for await (const chunk of upstream.body) res.write(chunk);
  res.end();
}

export async function handleMovieBoxRequest(req, res, url) {
  if (!url.pathname.startsWith("/v1/moviebox/")) return false;

  try {
    if (req.method === "OPTIONS") {
      send(res, 204, "", corsHeaders());
      return true;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "method not allowed", corsHeaders());
      return true;
    }

    if (url.pathname === "/v1/moviebox/resolve") await resolve(req, res, url);
    else if (url.pathname === "/v1/moviebox/file") await file(req, res, url);
    else send(res, 404, "not found", corsHeaders());
  } catch (error) {
    console.error(
      "[pinflix-moviebox-bridge]",
      error instanceof Error ? error.message : error,
    );
    send(res, 502, "MovieBox bridge unavailable", corsHeaders());
  }

  return true;
}

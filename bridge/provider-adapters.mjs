import { createHash } from "node:crypto";

const VIDEO_EXTENSIONS = new Set([
  "mp4", "m4v", "webm", "ogg", "ogv", "mkv", "avi", "mov",
  "ts", "m2ts", "mts", "mpg", "mpeg", "wmv", "flv", "m3u8", "m3u",
]);
const MAX_REDIRECTS = 4;

function assertAllowed(source, raw) {
  const target = raw instanceof URL ? raw : new URL(raw, source.base);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("unsupported provider protocol");
  }
  if (target.origin !== source.base.origin) throw new Error("provider origin mismatch");
  if (!target.pathname.startsWith(source.base.pathname)) throw new Error("provider path outside source root");
  return target;
}

function relativePath(source, target) {
  const pathname = target.pathname.startsWith(source.base.pathname)
    ? target.pathname.slice(source.base.pathname.length)
    : "";
  return `${pathname}${target.search || ""}`;
}

function extensionOf(target) {
  const name = decodeURIComponent(target.pathname.split("/").pop() || "");
  const match = name.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() || "";
}

function idFor(source, path) {
  return createHash("sha1").update(`${source.id}:${path}`).digest("hex").slice(0, 16);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
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

function bestAnchorTitle(innerHtml, fallback) {
  const alt = innerHtml.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1];
  const title = innerHtml.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1];
  const text = decodeHtml(innerHtml);
  const chosen = decodeHtml(alt || title || text);
  return chosen && chosen.length <= 220 ? chosen : fallback;
}

async function providerFetch(source, initial, init = {}) {
  let current = assertAllowed(source, initial);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const headers = new Headers(source.headers);
    headers.set("user-agent", "Mozilla/5.0 PinflixProviderBridge/1.0");
    if (init.accept) headers.set("accept", init.accept);
    if (init.contentType) headers.set("content-type", init.contentType);
    if (init.headers) {
      for (const [name, value] of Object.entries(init.headers)) {
        if (typeof value === "string" && value) headers.set(name, value);
      }
    }

    const response = await fetch(current, {
      method: init.method || "GET",
      headers,
      body: init.body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeout || 15_000),
    });

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current };
    }
    if (redirect === MAX_REDIRECTS) throw new Error("too many provider redirects");
    const location = response.headers.get("location");
    if (!location) throw new Error("invalid provider redirect");
    current = assertAllowed(source, new URL(location, current));
  }
  throw new Error("provider redirect failed");
}

function mapDhakaItem(source, row) {
  const rawHref = typeof row?.href === "string" ? row.href : "";
  if (!rawHref) return null;

  let target;
  try {
    target = assertAllowed(source, new URL(rawHref, source.base));
  } catch {
    return null;
  }

  const path = relativePath(source, target);
  if (!path) return null;
  const ext = extensionOf(target);
  const video = VIDEO_EXTENSIONS.has(ext);
  const decoded = decodeURIComponent(target.pathname.replace(/\/$/, "").split("/").pop() || "");
  const rawName = typeof row?.name === "string" ? row.name : "";
  const name = decodeHtml(rawName) || decoded || "Untitled";

  return {
    id: idFor(source, path),
    type: video ? "video" : "directory",
    name,
    path,
    extension: ext || null,
    playable: video,
  };
}

async function browseDhakaFlix(source, path) {
  const target = assertAllowed(source, new URL(String(path || "").replace(/^\/+/, "") || "./", source.base));
  const href = target.pathname.endsWith("/") ? target.pathname : `${target.pathname}/`;
  const body = JSON.stringify({
    action: "get",
    items: { href, what: 1 },
  });

  const { response } = await providerFetch(source, source.base, {
    method: "POST",
    contentType: "application/json",
    accept: "application/json,text/plain,*/*",
    body,
    timeout: 12_000,
  });
  if (!response.ok) throw new Error(`DHAKA-FLIX browse failed: ${response.status}`);

  const payload = await response.json();
  const rows = Array.isArray(payload?.items) ? payload.items : [];
  const items = rows
    .map((row) => mapDhakaItem(source, row))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

  return {
    path: relativePath(source, target),
    items: items.slice(0, 1500),
  };
}

function cineplexLinkItems(source, html, pageUrl) {
  const items = [];
  const seen = new Set();
  const regex = /<a\b[^>]*href\s*=\s*["']([^"']*(?:view\.php|tview\.php|watch\.php)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    let target;
    try {
      target = assertAllowed(source, new URL(match[1], pageUrl));
    } catch {
      continue;
    }
    const path = relativePath(source, target);
    if (!path || seen.has(path)) continue;
    seen.add(path);

    const isSeries = /(?:^|\/)watch\.php$/i.test(target.pathname);
    const id = target.searchParams.get("series_id") || target.searchParams.get("id") || "";
    const fallback = isSeries ? `Series ${id}` : `Movie ${id}`;
    const name = bestAnchorTitle(match[2], fallback);

    items.push({
      id: idFor(source, path),
      type: isSeries ? "directory" : "video",
      name,
      path,
      extension: null,
      playable: !isSeries,
    });
  }
  return items;
}

function seasonValues(html) {
  const values = [];
  const seen = new Set();
  const select = html.match(/<select\b[^>]*name\s*=\s*["']season["'][^>]*>([\s\S]*?)<\/select>/i)?.[1] || "";
  const regex = /<option\b[^>]*value\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  let match;
  while ((match = regex.exec(select))) {
    const value = decodeHtml(match[1]).replace(/^\/+|\/+$/g, "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push({ value, label: decodeHtml(match[2]) || `Season ${value}` });
  }
  return values;
}

function paramInfo(target) {
  if (target.searchParams.has("series_id")) return ["series_id", target.searchParams.get("series_id") || ""];
  return ["id", target.searchParams.get("id") || ""];
}

async function cineplexEpisodes(source, target, html) {
  const [paramName, id] = paramInfo(target);
  if (!id) return [];

  const selectedSeason = target.searchParams.get("season");
  const seasons = seasonValues(html);
  if (!selectedSeason && seasons.length > 1) {
    return seasons.map((season) => {
      const next = new URL(target);
      next.searchParams.set("season", season.value);
      next.searchParams.delete("ep");
      const path = relativePath(source, next);
      return {
        id: idFor(source, path),
        type: "directory",
        name: season.label,
        path,
        extension: null,
        playable: false,
      };
    });
  }

  const season = selectedSeason || seasons[0]?.value || "1";
  const meta = new URL(target);
  meta.searchParams.set("season", season);
  meta.searchParams.set("meta", "1");
  meta.searchParams.delete("ep");

  const { response } = await providerFetch(source, meta, {
    accept: "application/json,text/plain,*/*",
    timeout: 12_000,
  });
  if (!response.ok) return [];

  let payload;
  try {
    payload = await response.json();
  } catch {
    return [];
  }

  const episodes = payload?.episodes && typeof payload.episodes === "object"
    ? Object.entries(payload.episodes)
    : [];

  return episodes.map(([key, raw]) => {
    const ep = raw && typeof raw === "object" ? raw : {};
    const epNumber = String(ep.episode_number ?? key);
    let episodeTarget;
    const rawPath = typeof ep.path === "string" ? ep.path : "";
    try {
      if (rawPath.includes("watch.php")) {
        episodeTarget = assertAllowed(source, new URL(rawPath, source.base));
      } else {
        episodeTarget = new URL("/watch.php", source.base);
        episodeTarget.searchParams.set(paramName, id);
        episodeTarget.searchParams.set("season", season);
        episodeTarget.searchParams.set("ep", epNumber);
        episodeTarget = assertAllowed(source, episodeTarget);
      }
    } catch {
      return null;
    }
    const path = relativePath(source, episodeTarget);
    const title = decodeHtml(ep.title || "") || `Episode ${epNumber}`;
    return {
      id: idFor(source, path),
      type: "video",
      name: title,
      path,
      extension: null,
      playable: true,
    };
  }).filter(Boolean);
}

async function browseCineplex(source, path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean) {
    const catalogue = assertAllowed(source, new URL("search.php?q=&page=1", source.base));
    const { response, finalUrl } = await providerFetch(source, catalogue, {
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      timeout: 12_000,
    });
    if (!response.ok) throw new Error(`Cineplex catalogue failed: ${response.status}`);
    const html = await response.text();
    return { path: "", items: cineplexLinkItems(source, html, finalUrl).slice(0, 500) };
  }

  const target = assertAllowed(source, new URL(clean, source.base));
  if (/\/watch\.php$/i.test(target.pathname) && !target.searchParams.has("ep")) {
    const { response, finalUrl } = await providerFetch(source, target, {
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      timeout: 12_000,
    });
    if (!response.ok) throw new Error(`Cineplex series failed: ${response.status}`);
    const html = await response.text();
    const items = await cineplexEpisodes(source, finalUrl, html);
    return { path: relativePath(source, finalUrl), items };
  }

  return null;
}

function setCookieHeader(response) {
  const h = response.headers;
  const values = typeof h.getSetCookie === "function" ? h.getSetCookie() : [];
  if (values.length) {
    return values
      .map((value) => value.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }
  const fallback = h.get("set-cookie");
  return fallback ? fallback.split(",").map((v) => v.split(";")[0]?.trim()).filter(Boolean).join("; ") : "";
}

function cineplexVideoUrl(html) {
  return (
    html.match(/const\s+videoSrc\s*=\s*["']([^"']+)["']/i)?.[1] ||
    html.match(/<source\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1] ||
    ""
  );
}

function transformCineplexVod(raw, source) {
  if (!raw) return null;
  if (/^http:\/\/vod\.cineplexbd\.net:8081\//i.test(raw)) {
    let path = raw.replace(/^http:\/\/vod\.cineplexbd\.net:8081\//i, "/hls/");
    path = path.replace(/^\/hls\/tv-series\//i, "/hls/t/");
    path = path.replace(/^\/hls\/movies\//i, "/hls/m/");
    path = path.replace(/\/index\.m3u8(?:\?.*)?$/i, "/master.m3u8");
    return assertAllowed(source, new URL(path, source.base));
  }
  return assertAllowed(source, new URL(raw, source.base));
}

async function resolveCineplex(source, path) {
  let target = assertAllowed(source, new URL(String(path || "").replace(/^\/+/, ""), source.base));

  if (/\/(?:view|tview)\.php$/i.test(target.pathname)) {
    const id = target.searchParams.get("id");
    if (!id) throw new Error("Cineplex movie id missing");
    const player = new URL("player.php", source.base);
    player.searchParams.set("id", id);
    target = assertAllowed(source, player);
  }

  if (
    VIDEO_EXTENSIONS.has(extensionOf(target)) ||
    target.pathname.includes("/Data/") ||
    /\.m3u8?(?:$|\?)/i.test(target.href)
  ) {
    return { target, headers: { referer: target.href } };
  }

  const { response, finalUrl } = await providerFetch(source, target, {
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    timeout: 15_000,
  });
  if (!response.ok) throw new Error(`Cineplex player failed: ${response.status}`);
  const cookies = setCookieHeader(response);
  const html = await response.text();
  const rawVideo = cineplexVideoUrl(html);
  if (!rawVideo) throw new Error("Cineplex video source not found");
  const video = transformCineplexVod(rawVideo, source);
  if (!video) throw new Error("Cineplex video URL invalid");

  const headers = { referer: finalUrl.href };
  if (cookies) headers.cookie = cookies;
  return { target: video, headers };
}

export async function browseWithAdapter(source, path) {
  if (source.adapter === "dhakaflix-json") return browseDhakaFlix(source, path);
  if (source.adapter === "cineplexbd") return browseCineplex(source, path);
  return null;
}

export async function resolveWithAdapter(source, path) {
  if (source.adapter === "cineplexbd") return resolveCineplex(source, path);
  return null;
}

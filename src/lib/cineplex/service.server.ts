import "server-only";

import type {
  MediaCatalogPage,
  MediaDetail,
  MediaHome,
  MediaItem,
  MediaKind,
  MediaSeason,
} from "@/types/catalog";

const BASE = "http://cineplexbd.net";
const EDGE = process.env.CINEPLEX_MEDIA_EDGE_BASE?.trim() || "https://media.pincodeit.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";
const TIMEOUT_MS = 12_000;

type CineplexKind = "movie" | "series";

function decodeHtml(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(raw: string, pageUrl = BASE): string | null {
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function edgeAsset(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol === "http:" &&
      (host === "cineplexbd.net" ||
        host === "www.cineplexbd.net" ||
        host === "vod.cineplexbd.net")
    ) {
      const edge = new URL("/proxy", EDGE);
      edge.searchParams.set("url", url.href);
      return edge.href;
    }
    return url.href;
  } catch {
    return null;
  }
}

async function fetchText(url: URL): Promise<{ text: string; finalUrl: string }> {
  const direct = async (target: string) =>
    fetch(target, {
      headers: {
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "user-agent": UA,
        referer: BASE + "/",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let response: Response | null = null;
  try {
    response = await direct(url.href);
  } catch {
    response = null;
  }

  if (!response?.ok) {
    const edge = new URL("/proxy", EDGE);
    edge.searchParams.set("url", url.href);
    response = await direct(edge.href);
  }

  if (!response.ok) {
    throw new Error(`CineplexBD request failed: ${response.status}`);
  }

  return { text: await response.text(), finalUrl: response.url || url.href };
}

async function fetchJson(url: URL): Promise<unknown> {
  const { text } = await fetchText(url);
  return JSON.parse(text) as unknown;
}

function itemKey(kind: CineplexKind, id: string): string {
  return `cineplex:${kind}:${id}`;
}

export function isCineplexDetailKey(value: string): boolean {
  return /^cineplex:(movie|series):[A-Za-z0-9_-]{1,64}$/.test(value);
}

function parseDetailKey(value: string): { kind: CineplexKind; id: string } {
  const match = value.match(/^cineplex:(movie|series):([A-Za-z0-9_-]{1,64})$/);
  if (!match) throw new Error("Invalid CineplexBD detail key");
  return { kind: match[1] as CineplexKind, id: match[2] };
}

function imageFrom(innerHtml: string, pageUrl: string): string | null {
  const raw =
    innerHtml.match(/<img\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1] ??
    innerHtml.match(/<img\b[^>]*data-src\s*=\s*["']([^"']+)["']/i)?.[1] ??
    null;
  return raw ? edgeAsset(absoluteUrl(raw, pageUrl)) : null;
}

function titleFrom(innerHtml: string, fallback: string): string {
  const alt = innerHtml.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1];
  const title = innerHtml.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1];
  return decodeHtml(alt || title || innerHtml) || fallback;
}

function parseItems(html: string, pageUrl: string): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();
  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']*(?:view\.php|tview\.php|watch\.php)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const href = absoluteUrl(match[1], pageUrl);
    if (!href) continue;

    const target = new URL(href);
    const path = target.pathname.toLowerCase();
    const id =
      target.searchParams.get("series_id") ??
      target.searchParams.get("id") ??
      "";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;

    const kind: CineplexKind =
      path.endsWith("/tview.php") ||
      (path.endsWith("/watch.php") && target.searchParams.has("series_id"))
        ? "series"
        : "movie";

    const key = itemKey(kind, id);
    if (seen.has(key)) continue;
    seen.add(key);

    const title = titleFrom(match[2], kind === "series" ? `Series ${id}` : `Movie ${id}`);
    const year = match[2].match(/\b(19|20)\d{2}\b/)?.[0] ?? null;

    items.push({
      id: key,
      source: "cineplexbd",
      kind: kind as MediaKind,
      title,
      poster: imageFrom(match[2], pageUrl),
      year,
      rating: null,
      badge: kind === "series" ? "Series" : "CineplexBD",
      detailKey: key,
    });
  }

  return items;
}

async function catalogPage(kind: CineplexKind, page: number): Promise<MediaItem[]> {
  const safePage = Math.max(1, Math.min(page, 100));
  const url =
    kind === "movie"
      ? new URL(`/search.php?q=&page=${safePage}`, BASE)
      : new URL(
          `/tcategory.php?category=${encodeURIComponent("Web Series")}&page=${safePage}`,
          BASE,
        );

  const { text, finalUrl } = await fetchText(url);
  return parseItems(text, finalUrl).filter((item) => item.kind === kind);
}

export async function getCineplexCatalog(
  kind: CineplexKind,
  page = 1,
): Promise<MediaCatalogPage> {
  const items = await catalogPage(kind, page);
  return {
    page,
    perPage: Math.max(1, items.length || 24),
    total: items.length,
    items,
  };
}

export async function searchCineplex(
  query: string,
  page = 1,
): Promise<MediaCatalogPage> {
  const safeQuery = query.trim().slice(0, 120);
  const safePage = Math.max(1, Math.min(page, 100));
  const url = new URL("/search.php", BASE);
  url.searchParams.set("q", safeQuery);
  url.searchParams.set("page", String(safePage));

  const { text, finalUrl } = await fetchText(url);
  const items = parseItems(text, finalUrl);

  return {
    page: safePage,
    perPage: Math.max(1, items.length || 24),
    total: items.length,
    items,
  };
}

export async function getCineplexHome(): Promise<MediaHome> {
  const [movies, series] = await Promise.allSettled([
    catalogPage("movie", 1),
    catalogPage("series", 1),
  ]);

  const sections = [
    {
      title: "CineplexBD Movies",
      items: movies.status === "fulfilled" ? movies.value.slice(0, 18) : [],
    },
    {
      title: "CineplexBD Series",
      items: series.status === "fulfilled" ? series.value.slice(0, 18) : [],
    },
  ].filter((section) => section.items.length > 0);

  return {
    status: sections.length ? "success" : "error",
    sections,
    ...(sections.length ? {} : { error: "CineplexBD is temporarily unavailable." }),
  };
}

function firstText(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const raw = html.match(pattern)?.[1];
    if (raw) {
      const value = decodeHtml(raw);
      if (value) return value;
    }
  }
  return "";
}

function posterFromPage(html: string, pageUrl: string): string | null {
  const raw =
    html.match(/<img\b[^>]*(?:class=["'][^"']*(?:poster|cover)[^"']*["'])[^>]*src=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i)?.[1] ??
    null;
  return raw ? edgeAsset(absoluteUrl(raw, pageUrl)) : null;
}

function seasonValues(html: string): number[] {
  const select =
    html.match(
      /<select\b[^>]*name\s*=\s*["']season["'][^>]*>([\s\S]*?)<\/select>/i,
    )?.[1] ?? "";
  const values: number[] = [];
  const seen = new Set<number>();
  const regex = /<option\b[^>]*value\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(select))) {
    const value = Number(match[1]);
    if (!Number.isInteger(value) || value < 0 || value > 500 || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function episodeCountFromMeta(payload: unknown): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 1;
  const record = payload as Record<string, unknown>;
  const episodes = record.episodes;
  if (!episodes || typeof episodes !== "object" || Array.isArray(episodes)) return 1;
  return Math.max(1, Object.keys(episodes as Record<string, unknown>).length);
}

async function seriesSeasons(id: string, html: string): Promise<MediaSeason[]> {
  const raw = seasonValues(html);
  const seasons = raw.length ? raw : [1];
  const out: MediaSeason[] = [];

  for (const season of seasons.slice(0, 50)) {
    const meta = new URL("/watch.php", BASE);
    meta.searchParams.set("series_id", id);
    meta.searchParams.set("season", String(season));
    meta.searchParams.set("meta", "1");

    let episodeCount = 1;
    try {
      episodeCount = episodeCountFromMeta(await fetchJson(meta));
    } catch {
      episodeCount = 1;
    }
    out.push({ number: season, episodeCount });
  }

  return out;
}

export async function getCineplexDetail(key: string): Promise<MediaDetail> {
  const { kind, id } = parseDetailKey(key);
  const page =
    kind === "series"
      ? new URL(`/watch.php?series_id=${encodeURIComponent(id)}`, BASE)
      : new URL(`/view.php?id=${encodeURIComponent(id)}`, BASE);

  const { text: html, finalUrl } = await fetchText(page);
  const title =
    firstText(html, [
      /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
      /<h2\b[^>]*>([\s\S]*?)<\/h2>/i,
      /<title\b[^>]*>([\s\S]*?)<\/title>/i,
    ]) || (kind === "series" ? `Series ${id}` : `Movie ${id}`);

  const overview = firstText(html, [
    /<(?:p|div)\b[^>]*class=["'][^"']*(?:synopsis|description|overview)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i,
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
  ]);

  const year = html.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
  const ratingRaw =
    html.match(/(?:IMDb|Rating)[^0-9]{0,30}([0-9](?:\.[0-9])?)/i)?.[1] ?? null;
  const rating = ratingRaw ? Number(ratingRaw) : null;

  const genreText = firstText(html, [
    /(?:Genre|Genres)\s*:?\s*<[^>]*>([\s\S]*?)<\/[^>]+>/i,
  ]);
  const genres = genreText
    .split(/[,·|]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);

  const seasons =
    kind === "series" ? await seriesSeasons(id, html) : [{ number: 0, episodeCount: 1 }];

  return {
    id: itemKey(kind, id),
    source: "cineplexbd",
    kind,
    title,
    poster: posterFromPage(html, finalUrl),
    year,
    rating: Number.isFinite(rating) ? rating : null,
    badge: "CineplexBD",
    detailKey: key,
    overview,
    genres,
    trailer: null,
    seasons,
    playback: {
      provider: "cineplex",
      id,
      slug: kind,
      defaultSeason: seasons[0]?.number ?? (kind === "series" ? 1 : 0),
      defaultEpisode: 1,
    },
  };
}

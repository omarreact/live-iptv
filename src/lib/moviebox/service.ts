import "server-only";

import { unstable_cache } from "next/cache";
import { movieboxRequest, movieboxRequestWithMeta, normalizeItem } from "./client";
import { extractPlayInfoHeaders, resolvePlayInfoUrl } from "./play-info.server";
import type {
  MovieBoxCaption,
  MovieBoxCaptionResponse,
  MovieBoxCategoryResponse,
  MovieBoxFilters,
  MovieBoxHomeResponse,
  MovieBoxItem,
  MovieBoxKind,
  MovieBoxSection,
  MovieBoxStreamResponse,
  MovieBoxStreamSource,
} from "./types";

const METADATA_REVALIDATE_SECONDS = 900;
const PLAYER_DOMAIN_TTL_MS = 5 * 60_000;
const PLAYER_DOMAIN_FALLBACK = "https://mzfi.me";
const SEARCH_REVALIDATE_SECONDS = 120;
const DETAIL_REVALIDATE_SECONDS = 1_800;
const FAILURE_BACKOFF_MS = 30_000;
const HOME_MAX_SECTIONS = 10;
const HOME_ITEMS_PER_SECTION = 12;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

function trimCache<T>(cache: Map<string, CacheEntry<T>>, maxEntries = 80): void {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
}

let homeCache: CacheEntry<MovieBoxHomeResponse> | null = null;
let homeInflight: Promise<MovieBoxHomeResponse> | null = null;
const categoryCache = new Map<string, CacheEntry<MovieBoxCategoryResponse>>();
const categoryInflight = new Map<string, Promise<MovieBoxCategoryResponse>>();
const detailCache = new Map<string, CacheEntry<unknown>>();
const detailInflight = new Map<string, Promise<unknown>>();

const PLAYER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "X-Client-Info": '{"timezone":"Asia/Dhaka"}',
  "X-Source": "",
  "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

type JsonRecord = Record<string, unknown>;

type SearchSuggestion = {
  title: string;
  slug: string | null;
  subject_id: string | number | null;
};

type SearchResponse = {
  query: string;
  page: number;
  items: MovieBoxItem[];
  total: number;
};

type UpstreamPlayerStream = {
  id?: string | number;
  url?: string;
  resolutions?: string | number;
  format?: string;
  size?: string | number;
  duration?: number;
  codecName?: string;
  headers?: Record<string, string>;
};

type PlayerData = {
  streams: UpstreamPlayerStream[];
  hls: JsonRecord[];
  dash: UpstreamPlayerStream[];
  hasResource: boolean;
  title?: string;
  freeNum?: number;
  maxResolution?: number;
  limited: boolean;
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nestedRecord(record: JsonRecord | null, key: string): JsonRecord | null {
  return record ? asRecord(record[key]) : null;
}

function dataRecord(value: unknown): JsonRecord {
  const root = asRecord(value);
  return asRecord(root?.data) ?? {};
}

function firstArray(record: JsonRecord, keys: readonly string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function responseTotal(inner: JsonRecord, fallback: number): number {
  const pager = nestedRecord(inner, "pager");
  return asFiniteNumber(pager?.totalCount) ?? asFiniteNumber(inner.total) ?? fallback;
}

function normalizeBannerItem(value: unknown): MovieBoxItem | null {
  const item = asRecord(value);
  if (!item) return null;

  const title = asString(item.title);
  if (!title || title.includes("Communities")) return null;

  const subject = nestedRecord(item, "subject");
  const image = nestedRecord(item, "image");
  const cover = nestedRecord(subject, "cover");

  return {
    name: title ?? asString(subject?.title) ?? "Untitled",
    poster_url: asString(image?.url) ?? asString(cover?.url),
    slug: asString(item.detailPath) ?? asString(subject?.detailPath),
    subject_id: asStringOrNumber(subject?.subjectId),
    badge: asString(subject?.corner),
    kind: "mixed",
  };
}

async function loadHome(): Promise<MovieBoxHomeResponse> {
  const payload = await movieboxRequest("/home", {
    searchParams: { host: "moviebox.ph" },
  });

  const data = dataRecord(payload);
  const operatingList = asArray(data.operatingList);
  const sections: MovieBoxSection[] = [];

  for (const rawOperation of operatingList) {
    const operation = asRecord(rawOperation);
    if (!operation) continue;

    const operationType = asString(operation.type);
    const title = asString(operation.title) ?? "Featured";

    if (operationType === "BANNER") {
      const banner = nestedRecord(operation, "banner");
      const items = asArray(banner?.items)
        .map(normalizeBannerItem)
        .filter((item): item is MovieBoxItem => item !== null);

      if (items.length) {
        sections.push({
          section: "Banner",
          count: Math.min(items.length, 4),
          items: items.slice(0, 4),
        });
      }

      continue;
    }

    let kind: MovieBoxKind | null = null;

    if (operationType === "SUBJECTS_MOVIE") kind = "movie";
    if (operationType === "SUBJECTS_TV") kind = "series";
    if (operationType === "SUBJECTS_ANIMATION") kind = "animation";

    if (!kind) continue;

    const items = asArray(operation.subjects).map((subject) => normalizeItem(subject, kind));

    if (items.length) {
      sections.push({
        section: title,
        count: Math.min(items.length, HOME_ITEMS_PER_SECTION),
        items: items.slice(0, HOME_ITEMS_PER_SECTION),
      });
    }

    if (sections.length >= HOME_MAX_SECTIONS) break;
  }

  return {
    status: "success",
    sections: sections.slice(0, HOME_MAX_SECTIONS),
  };
}

export async function getHome(): Promise<MovieBoxHomeResponse> {
  const now = Date.now();
  if (homeCache && homeCache.expiresAt > now) return homeCache.value;
  if (homeInflight) return homeInflight;

  const stale = homeCache?.value ?? null;

  homeInflight = loadHome()
    .then((value) => {
      homeCache = {
        value,
        expiresAt: Date.now() + METADATA_REVALIDATE_SECONDS * 1_000,
      };
      return value;
    })
    .catch((error: unknown) => {
      console.warn("[moviebox] home upstream unavailable", error);

      if (stale) {
        homeCache = {
          value: stale,
          expiresAt: Date.now() + FAILURE_BACKOFF_MS,
        };
        return stale;
      }

      return {
        status: "error" as const,
        sections: [],
        error: "Entertainment is temporarily unavailable.",
      };
    })
    .finally(() => {
      homeInflight = null;
    });

  return homeInflight;
}

async function loadCategory(
  tabId: number,
  page: number,
  perPage: number,
  sort: string,
  filters: MovieBoxFilters,
): Promise<MovieBoxCategoryResponse> {
  const payload = await movieboxRequest("/subject/filter", {
    method: "POST",
    body: {
      tabId,
      filter: {
        sort,
        genre: filters.genre ?? "ALL",
        country: filters.country ?? "ALL",
        year: filters.year ?? "ALL",
        language: filters.language ?? "ALL",
      },
      page,
      perPage,
    },
  });

  const inner = dataRecord(payload);
  const rawItems = firstArray(inner, ["items", "subjects"]);
  const fallbackKind: MovieBoxKind = tabId === 2 ? "movie" : tabId === 5 ? "series" : "animation";

  const items = rawItems.map((subject) => normalizeItem(subject, fallbackKind));

  return {
    page,
    per_page: perPage,
    total: responseTotal(inner, items.length),
    items,
  };
}

function categoryCacheKey(
  tabId: number,
  page: number,
  perPage: number,
  sort: string,
  filters: MovieBoxFilters,
): string {
  return [
    tabId,
    page,
    perPage,
    sort,
    filters.genre ?? "ALL",
    filters.country ?? "ALL",
    filters.year ?? "ALL",
    filters.language ?? "ALL",
  ].join("|");
}

async function safeCategory(
  tabId: number,
  page: number,
  perPage: number,
  sort: string,
  filters: MovieBoxFilters,
): Promise<MovieBoxCategoryResponse> {
  const key = categoryCacheKey(tabId, page, perPage, sort, filters);
  const cached = categoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inflight = categoryInflight.get(key);
  if (inflight) return inflight;

  const stale = cached?.value ?? null;
  const pending = loadCategory(tabId, page, perPage, sort, filters)
    .then((value) => {
      categoryCache.set(key, {
        value,
        expiresAt: Date.now() + METADATA_REVALIDATE_SECONDS * 1_000,
      });
      trimCache(categoryCache);
      return value;
    })
    .catch((error: unknown) => {
      console.warn("[moviebox] category upstream unavailable", {
        tabId,
        page,
        error,
      });

      if (stale) {
        categoryCache.set(key, {
          value: stale,
          expiresAt: Date.now() + FAILURE_BACKOFF_MS,
        });
        return stale;
      }

      return {
        page,
        per_page: perPage,
        total: 0,
        items: [],
      };
    })
    .finally(() => {
      categoryInflight.delete(key);
    });

  categoryInflight.set(key, pending);
  return pending;
}

export async function getMovies(
  page = 1,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
  perPage = 24,
): Promise<MovieBoxCategoryResponse> {
  return safeCategory(2, page, perPage, sort, filters);
}

export async function getTvSeries(
  page = 1,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
  perPage = 24,
): Promise<MovieBoxCategoryResponse> {
  return safeCategory(5, page, perPage, sort, filters);
}

export async function getAnimation(
  page = 1,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
  perPage = 24,
): Promise<MovieBoxCategoryResponse> {
  return safeCategory(8, page, perPage, sort, filters);
}

async function loadSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const payload = await movieboxRequest("/subject/search-suggest", {
    method: "POST",
    body: {
      keyword: query,
      perPage: 10,
    },
  });

  const inner = dataRecord(payload);
  const rawItems = firstArray(inner, ["items", "list"]);

  return rawItems
    .map((value): SearchSuggestion => {
      const item = asRecord(value) ?? {};
      const subject = nestedRecord(item, "subject");

      return {
        title: asString(subject?.title) ?? asString(item.word) ?? asString(item.title) ?? "",
        slug: asString(subject?.detailPath) ?? asString(item.detailPath),
        subject_id: asStringOrNumber(subject?.subjectId) ?? asStringOrNumber(item.subjectId),
      };
    })
    .filter((item) => Boolean(item.title));
}

async function loadSearch(query: string, page: number): Promise<SearchResponse> {
  try {
    const payload = await movieboxRequest("/subject/search", {
      method: "POST",
      body: {
        keyword: query,
        page,
        perPage: 24,
      },
    });

    const inner = dataRecord(payload);
    const rawItems = firstArray(inner, ["items", "subjects", "list"]);

    const items = rawItems.map((value) => {
      const record = asRecord(value);
      return normalizeItem(record?.subject ?? value);
    });

    return {
      query,
      page,
      items,
      total: responseTotal(inner, items.length),
    };
  } catch (primaryError: unknown) {
    try {
      const suggestions = await loadSearchSuggestions(query);
      const items: MovieBoxItem[] = suggestions.map((item) => ({
        name: item.title,
        poster_url: null,
        slug: item.slug,
        subject_id: item.subject_id,
        kind: "mixed",
      }));

      return {
        query,
        page,
        items,
        total: items.length,
      };
    } catch {
      console.error("[moviebox] search failed", primaryError);
      return {
        query,
        page,
        items: [],
        total: 0,
      };
    }
  }
}

const loadCachedSearch = unstable_cache(loadSearch, ["moviebox-search-v3"], {
  revalidate: SEARCH_REVALIDATE_SECONDS,
});

export async function search(query: string, page = 1): Promise<SearchResponse> {
  return loadCachedSearch(query.trim(), page);
}

async function loadDetail(slug: string): Promise<unknown> {
  const payload = await movieboxRequest("/detail", {
    searchParams: { detailPath: slug },
  });

  const root = asRecord(payload);
  return root?.data ?? payload;
}

export async function getDetail(slug: string): Promise<unknown> {
  const cached = detailCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inflight = detailInflight.get(slug);
  if (inflight) return inflight;

  const stale = cached?.value ?? null;
  const pending = loadDetail(slug)
    .then((value) => {
      detailCache.set(slug, {
        value,
        expiresAt: Date.now() + DETAIL_REVALIDATE_SECONDS * 1_000,
      });
      trimCache(detailCache);
      return value;
    })
    .catch((error: unknown) => {
      console.warn("[moviebox] detail upstream unavailable", { slug, error });

      if (stale !== null) {
        detailCache.set(slug, {
          value: stale,
          expiresAt: Date.now() + FAILURE_BACKOFF_MS,
        });
        return stale;
      }

      return null;
    })
    .finally(() => {
      detailInflight.delete(slug);
    });

  detailInflight.set(slug, pending);
  return pending;
}

let cachedPlayerDomain: { value: string; expiresAt: number } | null = null;
let playerDomainInflight: Promise<string> | null = null;

async function getPlayerDomain(): Promise<string> {
  if (cachedPlayerDomain && cachedPlayerDomain.expiresAt > Date.now()) {
    return cachedPlayerDomain.value;
  }
  if (playerDomainInflight) return playerDomainInflight;

  playerDomainInflight = (async () => {
    try {
      const payload = await movieboxRequest("/media-player/get-domain");
      const root = asRecord(payload);
      const domain = (asString(root?.data) ?? PLAYER_DOMAIN_FALLBACK).replace(/\/$/, "");
      cachedPlayerDomain = {
        value: domain,
        expiresAt: Date.now() + PLAYER_DOMAIN_TTL_MS,
      };
      console.info("[moviebox.player] selected domain", {
        domain: new URL(domain).hostname,
        source: root?.data ? "api" : "fallback",
      });
      return domain;
    } catch (error: unknown) {
      console.warn("[moviebox] player domain lookup failed; using last known domain", error);
      console.info("[moviebox.player] selected domain", {
        domain: new URL(cachedPlayerDomain?.value ?? PLAYER_DOMAIN_FALLBACK).hostname,
        source: cachedPlayerDomain ? "cached" : "fallback",
      });
      return cachedPlayerDomain?.value ?? PLAYER_DOMAIN_FALLBACK;
    }
  })().finally(() => {
    playerDomainInflight = null;
  });

  return playerDomainInflight;
}

function normalizePlayerStream(value: unknown): UpstreamPlayerStream | null {
  const record = asRecord(value);
  if (!record) return null;

  const url = resolvePlayInfoUrl(record, record.format ?? record.type);

  return {
    id: asStringOrNumber(record.id) ?? undefined,
    url: url ?? undefined,
    resolutions: asStringOrNumber(record.resolutions) ?? undefined,
    format: asString(record.format) ?? asString(record.type) ?? undefined,
    size: asStringOrNumber(record.size) ?? undefined,
    duration: asFiniteNumber(record.duration) ?? undefined,
    codecName: asString(record.codecName) ?? undefined,
    headers: extractPlayInfoHeaders(record),
  };
}

function parsePlayerData(payload: unknown): PlayerData {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? {};

  const streams = asArray(data.streams)
    .map(normalizePlayerStream)
    .filter((item): item is UpstreamPlayerStream => item !== null);

  const dash = asArray(data.dash)
    .map(normalizePlayerStream)
    .filter((item): item is UpstreamPlayerStream => item !== null);

  const hls = asArray(data.hls)
    .map(asRecord)
    .filter((item): item is JsonRecord => item !== null);

  return {
    streams,
    dash,
    hls,
    hasResource: Boolean(data.hasResource),
    title: asString(data.title) ?? undefined,
    freeNum: asFiniteNumber(data.freeNum) ?? undefined,
    maxResolution: asFiniteNumber(nestedRecord(data, "playConfig")?.maxResolution) ?? undefined,
    limited: Boolean(data.limited),
  };
}

async function fetchPlayerData(
  domain: string,
  subjectId: string | number,
  detailPath: string,
  se: number,
  ep: number,
): Promise<PlayerData> {
  const playerReferer =
    domain +
    "/spa/videoPlayPage/movies/" +
    detailPath +
    "?id=" +
    subjectId +
    "&type=/movie/detail&detailSe=" +
    se +
    "&detailEp=" +
    ep +
    "&lang=en";

  const playUrl =
    domain +
    "/wefeed-h5api-bff/subject/play?subjectId=" +
    encodeURIComponent(String(subjectId)) +
    "&se=" +
    se +
    "&ep=" +
    ep +
    "&detailPath=" +
    encodeURIComponent(detailPath) +
    "&_ts=" +
    Date.now();

  const response = await movieboxRequestWithMeta<unknown>(playUrl, {
    headers: {
      ...PLAYER_HEADERS,
      Referer: playerReferer,
      Origin: new URL(domain).origin,
    },
    requireToken: true,
  });

  const parsed = parsePlayerData(response.data);
  console.info("[moviebox.player] upstream response", {
    domain: new URL(domain).hostname,
    status: response.status,
    hasResource: parsed.hasResource,
    streams: parsed.streams.length,
    hls: parsed.hls.length,
    dash: parsed.dash.length,
    authorizationUsed: response.authorizationUsed,
    season: se,
    episode: ep,
  });
  const mediaHeaders = {
    Referer: playerReferer,
    Origin: new URL(domain).origin,
  };

  const attachMediaHeaders = (stream: UpstreamPlayerStream): UpstreamPlayerStream => ({
    ...stream,
    headers: {
      ...mediaHeaders,
      ...(stream.headers ?? {}),
    },
  });

  return {
    ...parsed,
    streams: parsed.streams.map(attachMediaHeaders),
    dash: parsed.dash.map(attachMediaHeaders),
  };
}

function normalizeStreamData(
  data: PlayerData,
  subjectId: string | number,
  se: number,
  ep: number,
): MovieBoxStreamResponse {
  const sources: MovieBoxStreamSource[] = data.streams
    .filter((stream): stream is UpstreamPlayerStream & { url: string } => {
      if (!stream.url) return false;

      const resolution = asFiniteNumber(stream.resolutions);
      return !(
        data.maxResolution &&
        data.maxResolution > 0 &&
        resolution &&
        resolution > data.maxResolution
      );
    })
    .map((stream) => ({
      id: stream.id,
      quality: stream.resolutions !== undefined ? `${String(stream.resolutions)}p` : undefined,
      url: stream.url,
      type: (stream.format ?? "mp4").toLowerCase(),
      size: stream.size,
      duration: stream.duration,
      codec: stream.codecName,
      headers: stream.headers,
    }));

  const hasResource =
    data.hasResource || sources.length > 0 || data.hls.length > 0 || data.dash.length > 0;

  return {
    subject_id: subjectId,
    se,
    ep,
    sources,
    subtitles: [],
    title: data.title,
    has_resource: hasResource,
    hls: data.hls,
    dash: data.dash.map((entry) => ({ ...entry })),
    free_episodes: data.freeNum,
    limited: data.limited,
    note: hasResource ? null : "No stream found for this episode.",
  };
}

export async function getStreamSources(
  subjectId: string | number,
  detailPath: string,
  se = 1,
  ep = 1,
): Promise<MovieBoxStreamResponse> {
  const domain = await getPlayerDomain();

  let usedSe = Number.isFinite(se) ? se : 1;
  let usedEp = Number.isFinite(ep) ? ep : 1;

  let normalized = normalizeStreamData(
    await fetchPlayerData(domain, subjectId, detailPath, usedSe, usedEp),
    subjectId,
    usedSe,
    usedEp,
  );

  if (!normalized.has_resource && usedSe !== 0) {
    const fallbackNormalized = normalizeStreamData(
      await fetchPlayerData(domain, subjectId, detailPath, 0, 1),
      subjectId,
      0,
      1,
    );

    if (fallbackNormalized.has_resource) {
      normalized = fallbackNormalized;
      usedSe = 0;
      usedEp = 1;
    }
  }

  return {
    ...normalized,
    se: usedSe,
    ep: usedEp,
  };
}

function normalizeCaption(value: unknown): MovieBoxCaption | null {
  const record = asRecord(value);
  if (!record) return null;

  return { ...record };
}

export async function getCaptions(
  subjectId: string | number,
  detailPath: string,
  se = 1,
  ep = 1,
): Promise<MovieBoxCaptionResponse> {
  const domain = await getPlayerDomain();

  let usedSe = se;
  let usedEp = ep;

  let playData = await fetchPlayerData(domain, subjectId, detailPath, usedSe, usedEp);

  if (
    playData.streams.length === 0 &&
    playData.hls.length === 0 &&
    playData.dash.length === 0 &&
    usedSe !== 0
  ) {
    const fallback = await fetchPlayerData(domain, subjectId, detailPath, 0, 1);

    if (fallback.streams.length || fallback.hls.length || fallback.dash.length) {
      playData = fallback;
      usedSe = 0;
      usedEp = 1;
    }
  }

  const first = playData.streams[0] ?? playData.dash[0];
  const streamId = first?.id;
  const streamFormat = first?.format ?? (playData.streams.length ? "MP4" : "DASH");

  if (streamId === undefined) {
    return {
      subject_id: subjectId,
      se: usedSe,
      ep: usedEp,
      count: 0,
      captions: [],
    };
  }

  const payload = await movieboxRequest("/subject/caption", {
    searchParams: {
      format: streamFormat,
      id: streamId,
      subjectId,
      detailPath,
    },
  });

  const root = asRecord(payload);
  const inner = root?.data;

  const rawCaptions = Array.isArray(inner)
    ? inner
    : firstArray(asRecord(inner) ?? {}, ["captions"]);

  const captions = rawCaptions
    .map(normalizeCaption)
    .filter((item): item is MovieBoxCaption => item !== null);

  return {
    subject_id: subjectId,
    se: usedSe,
    ep: usedEp,
    count: captions.length,
    captions,
  };
}

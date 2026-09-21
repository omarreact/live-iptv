import "server-only";

import { unstable_cache } from "next/cache";
import { movieboxRequest, normalizeItem } from "./client";
import {
  extractPlayInfoHeaders,
  resolvePlayInfoUrl,
} from "./play-info.server";
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

const PLAYER_TIMEOUT_MS = 10_000;
const METADATA_REVALIDATE_SECONDS = 300;
const PLAYER_DOMAIN_TTL_MS = 5 * 60_000;
const PLAYER_DOMAIN_FALLBACK = "https://mzfi.me";
const SEARCH_REVALIDATE_SECONDS = 120;
const DETAIL_REVALIDATE_SECONDS = 600;

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
  limited: boolean;
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number"
    ? value
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nestedRecord(
  record: JsonRecord | null,
  key: string,
): JsonRecord | null {
  return record ? asRecord(record[key]) : null;
}

function dataRecord(value: unknown): JsonRecord {
  const root = asRecord(value);
  return asRecord(root?.data) ?? {};
}

function firstArray(
  record: JsonRecord,
  keys: readonly string[],
): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function responseTotal(
  inner: JsonRecord,
  fallback: number,
): number {
  const pager = nestedRecord(inner, "pager");
  return (
    asFiniteNumber(pager?.totalCount) ??
    asFiniteNumber(inner.total) ??
    fallback
  );
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
    poster_url:
      asString(image?.url) ??
      asString(cover?.url),
    slug:
      asString(item.detailPath) ??
      asString(subject?.detailPath),
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
          count: items.length,
          items,
        });
      }

      continue;
    }

    let kind: MovieBoxKind | null = null;

    if (operationType === "SUBJECTS_MOVIE") kind = "movie";
    if (operationType === "SUBJECTS_TV") kind = "series";
    if (operationType === "SUBJECTS_ANIMATION") kind = "animation";

    if (!kind) continue;

    const items = asArray(operation.subjects).map((subject) =>
      normalizeItem(subject, kind),
    );

    if (items.length) {
      sections.push({
        section: title,
        count: items.length,
        items,
      });
    }
  }

  return {
    status: "success",
    sections,
  };
}

const loadCachedHome = unstable_cache(
  loadHome,
  ["moviebox-home-v3"],
  { revalidate: METADATA_REVALIDATE_SECONDS },
);

export async function getHome(): Promise<MovieBoxHomeResponse> {
  try {
    return await loadCachedHome();
  } catch (error: unknown) {
    console.error("[moviebox] getHome failed", error);
    return {
      status: "error",
      sections: [],
      error: "Failed to load entertainment home",
    };
  }
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
  const fallbackKind: MovieBoxKind =
    tabId === 2 ? "movie" : tabId === 5 ? "series" : "animation";

  const items = rawItems.map((subject) =>
    normalizeItem(subject, fallbackKind),
  );

  return {
    page,
    per_page: perPage,
    total: responseTotal(inner, items.length),
    items,
  };
}

const loadCachedCategory = unstable_cache(
  loadCategory,
  ["moviebox-category-v3"],
  { revalidate: METADATA_REVALIDATE_SECONDS },
);

async function safeCategory(
  tabId: number,
  page: number,
  perPage: number,
  sort: string,
  filters: MovieBoxFilters,
): Promise<MovieBoxCategoryResponse> {
  try {
    return await loadCachedCategory(tabId, page, perPage, sort, filters);
  } catch (error: unknown) {
    console.error("[moviebox] category failed", { tabId, page, error });
    return {
      page,
      per_page: perPage,
      total: 0,
      items: [],
    };
  }
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

async function loadSearchSuggestions(
  query: string,
): Promise<SearchSuggestion[]> {
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
        title:
          asString(subject?.title) ??
          asString(item.word) ??
          asString(item.title) ??
          "",
        slug:
          asString(subject?.detailPath) ??
          asString(item.detailPath),
        subject_id:
          asStringOrNumber(subject?.subjectId) ??
          asStringOrNumber(item.subjectId),
      };
    })
    .filter((item) => Boolean(item.title));
}

async function loadSearch(
  query: string,
  page: number,
): Promise<SearchResponse> {
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

const loadCachedSearch = unstable_cache(
  loadSearch,
  ["moviebox-search-v3"],
  { revalidate: SEARCH_REVALIDATE_SECONDS },
);

export async function search(
  query: string,
  page = 1,
): Promise<SearchResponse> {
  return loadCachedSearch(query.trim(), page);
}

async function loadDetail(slug: string): Promise<unknown> {
  const payload = await movieboxRequest("/detail", {
    searchParams: { detailPath: slug },
  });

  const root = asRecord(payload);
  return root?.data ?? payload;
}

const loadCachedDetail = unstable_cache(
  loadDetail,
  ["moviebox-detail-v3"],
  { revalidate: DETAIL_REVALIDATE_SECONDS },
);

export async function getDetail(slug: string): Promise<unknown> {
  return loadCachedDetail(slug);
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
      return domain;
    } catch (error: unknown) {
      console.warn("[moviebox] player domain lookup failed; using last known domain", error);
      return cachedPlayerDomain?.value ?? PLAYER_DOMAIN_FALLBACK;
    }
  })().finally(() => {
    playerDomainInflight = null;
  });

  return playerDomainInflight;
}

function normalizePlayerStream(
  value: unknown,
): UpstreamPlayerStream | null {
  const record = asRecord(value);
  if (!record) return null;

  const url = resolvePlayInfoUrl(record, record.format ?? record.type);

  return {
    id: asStringOrNumber(record.id) ?? undefined,
    url: url ?? undefined,
    resolutions:
      asStringOrNumber(record.resolutions) ?? undefined,
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
    encodeURIComponent(detailPath);

  const response = await fetch(playUrl, {
    headers: {
      ...PLAYER_HEADERS,
      Referer: playerReferer,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(PLAYER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Stream upstream error: ${response.status} ${response.statusText}`,
    );
  }

  return parsePlayerData(await response.json());
}

function normalizeStreamData(
  data: PlayerData,
  subjectId: string | number,
  se: number,
  ep: number,
): MovieBoxStreamResponse {
  const sources: MovieBoxStreamSource[] = data.streams
    .filter(
      (stream): stream is UpstreamPlayerStream & { url: string } =>
        Boolean(stream.url),
    )
    .map((stream) => ({
      id: stream.id,
      quality:
        stream.resolutions !== undefined
          ? `${String(stream.resolutions)}p`
          : undefined,
      url: stream.url,
      type: (stream.format ?? "mp4").toLowerCase(),
      size: stream.size,
      duration: stream.duration,
      codec: stream.codecName,
      headers: stream.headers,
    }));

  const hasResource =
    data.hasResource ||
    sources.length > 0 ||
    data.hls.length > 0 ||
    data.dash.length > 0;

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
    await fetchPlayerData(
      domain,
      subjectId,
      detailPath,
      usedSe,
      usedEp,
    ),
    subjectId,
    usedSe,
    usedEp,
  );

  if (!normalized.has_resource && usedSe !== 0) {
    const fallbackNormalized = normalizeStreamData(
      await fetchPlayerData(
        domain,
        subjectId,
        detailPath,
        0,
        1,
      ),
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

  let playData = await fetchPlayerData(
    domain,
    subjectId,
    detailPath,
    usedSe,
    usedEp,
  );

  if (
    playData.streams.length === 0 &&
    playData.dash.length === 0 &&
    usedSe !== 0
  ) {
    const fallback = await fetchPlayerData(
      domain,
      subjectId,
      detailPath,
      0,
      1,
    );

    if (fallback.streams.length || fallback.dash.length) {
      playData = fallback;
      usedSe = 0;
      usedEp = 1;
    }
  }

  const first = playData.streams[0] ?? playData.dash[0];
  const streamId = first?.id;
  const streamFormat =
    first?.format ?? (playData.streams.length ? "MP4" : "DASH");

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

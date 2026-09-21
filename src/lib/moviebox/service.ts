import "server-only";

import { movieboxRequest, normalizeItem } from "./client";
import type {
  MovieBoxCaptionResponse,
  MovieBoxCategoryResponse,
  MovieBoxFilters,
  MovieBoxHomeResponse,
  MovieBoxItem,
  MovieBoxSection,
  MovieBoxStreamResponse,
} from "./types";

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

export async function getHome(): Promise<MovieBoxHomeResponse> {
  try {
    const data = await movieboxRequest<any>("/home", {
      searchParams: { host: "moviebox.ph" },
    });

    const sections: MovieBoxSection[] = [];

    for (const op of data?.data?.operatingList || []) {
      const opType = op?.type;
      const title = op?.title || "Featured";

      if (opType === "BANNER") {
        const items: MovieBoxItem[] = (op?.banner?.items || [])
          .filter(
            (item: any) =>
              item?.title && !String(item.title).includes("Communities"),
          )
          .map((item: any) => ({
            name: item.title || item.subject?.title || "Untitled",
            poster_url: item.image?.url || item.subject?.cover?.url || null,
            slug: item.detailPath || item.subject?.detailPath || null,
            subject_id: item.subject?.subjectId || null,
            badge: item.subject?.corner || null,
            kind: "mixed" as const,
          }));

        if (items.length) {
          sections.push({ section: "Banner", count: items.length, items });
        }
      } else if (
        ["SUBJECTS_MOVIE", "SUBJECTS_TV", "SUBJECTS_ANIMATION"].includes(opType)
      ) {
        const kind =
          opType === "SUBJECTS_MOVIE"
            ? "movie"
            : opType === "SUBJECTS_TV"
              ? "series"
              : "animation";

        const items = (op?.subjects || []).map((sub: any) =>
          normalizeItem(sub, kind),
        );

        if (items.length) {
          sections.push({ section: title, count: items.length, items });
        }
      }
    }

    return { status: "success", sections };
  } catch (err) {
    console.error("[moviebox] getHome failed", err);
    return {
      status: "error",
      sections: [],
      error: "Failed to load MovieBox home",
    };
  }
}

async function getCategory(
  tabId: number,
  page = 1,
  perPage = 24,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
): Promise<MovieBoxCategoryResponse> {
  const data = await movieboxRequest<any>("/subject/filter", {
    method: "POST",
    body: {
      tabId,
      filter: {
        sort,
        genre: filters.genre || "ALL",
        country: filters.country || "ALL",
        year: filters.year || "ALL",
        language: filters.language || "ALL",
      },
      page,
      perPage,
    },
  });

  const inner = data?.data || {};
  const rawItems = inner.items || inner.subjects || [];
  const fallbackKind =
    tabId === 2 ? "movie" : tabId === 5 ? "series" : "animation";
  const items = rawItems.map((sub: any) => normalizeItem(sub, fallbackKind));

  const pager = inner.pager || {};
  const total = pager.totalCount || inner.total || items.length;

  return {
    page,
    per_page: perPage,
    total,
    items,
  };
}

export async function getMovies(
  page = 1,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
  perPage = 24,
) {
  return getCategory(2, page, perPage, sort, filters);
}

export async function getTvSeries(
  page = 1,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
  perPage = 24,
) {
  return getCategory(5, page, perPage, sort, filters);
}

export async function getAnimation(
  page = 1,
  sort = "RECOMMEND",
  filters: MovieBoxFilters = {},
  perPage = 24,
) {
  return getCategory(8, page, perPage, sort, filters);
}

export async function getSearchSuggestions(query: string) {
  const data = await movieboxRequest<any>("/subject/search-suggest", {
    method: "POST",
    body: { keyword: query, perPage: 10 },
  });

  const inner = data?.data || {};
  const rawItems = inner.items || inner.list || [];
  const suggestions = rawItems.map((item: any) => {
    const subject = item?.subject || {};
    return {
      title: subject.title || item.word || item.title || "",
      slug: subject.detailPath || item.detailPath || null,
      subject_id: subject.subjectId || item.subjectId || null,
    };
  });

  return { suggestions };
}

export async function search(query: string, page = 1) {
  try {
    const data = await movieboxRequest<any>("/subject/search", {
      method: "POST",
      body: {
        keyword: query,
        page,
        perPage: 24,
      },
    });

    const inner = data?.data || {};
    const rawItems = inner.items || inner.subjects || inner.list || [];
    const items = rawItems.map((sub: any) =>
      normalizeItem(sub?.subject || sub),
    );

    const pager = inner.pager || {};
    return {
      query,
      page,
      items,
      total: pager.totalCount || inner.total || items.length,
    };
  } catch (primaryErr) {
    try {
      const suggestionData = await getSearchSuggestions(query);
      const items = suggestionData.suggestions
        .filter((item: any) => item.title)
        .map((item: any) => ({
          name: item.title,
          poster_url: null,
          slug: item.slug,
          subject_id: item.subject_id,
          kind: "mixed" as const,
        }));

      return {
        query,
        page,
        items,
        total: items.length,
      };
    } catch {
      console.error("[moviebox] search failed", primaryErr);
      return { query, page, items: [], total: 0 };
    }
  }
}

export async function getDetail(slug: string) {
  const data = await movieboxRequest<any>("/detail", {
    searchParams: { detailPath: slug },
  });
  return data?.data ?? data;
}

async function getPlayerDomain() {
  const domData = await movieboxRequest<any>("/media-player/get-domain");
  return String(domData?.data || "https://netfilm.world").replace(/\/$/, "");
}

async function fetchPlayerData(
  domain: string,
  subjectId: string | number,
  detailPath: string,
  se: number,
  ep: number,
) {
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

  const resp = await fetch(playUrl, {
    headers: {
      ...PLAYER_HEADERS,
      Referer: playerReferer,
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error("Stream upstream error: " + resp.status);
  }

  const json = await resp.json();
  return json?.data || {};
}

function normalizeStreamData(
  data: any,
  subjectId: string | number,
  se: number,
  ep: number,
): MovieBoxStreamResponse {
  const sources = (data.streams || [])
    .filter((stream: any) => Boolean(stream?.url))
    .map((stream: any) => ({
      id: stream.id,
      quality: stream.resolutions ? String(stream.resolutions) + "p" : undefined,
      url: stream.url,
      type: String(stream.format || "mp4").toLowerCase(),
      size: stream.size,
      duration: stream.duration,
      codec: stream.codecName,
    }));

  const hasResource =
    Boolean(data.hasResource) ||
    sources.length > 0 ||
    (Array.isArray(data.hls) && data.hls.length > 0) ||
    (Array.isArray(data.dash) && data.dash.length > 0);

  return {
    subject_id: subjectId,
    se,
    ep,
    sources,
    subtitles: [],
    title: data.title,
    has_resource: hasResource,
    hls: data.hls || [],
    dash: data.dash || [],
    free_episodes: data.freeNum,
    limited: Boolean(data.limited),
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
  let data = await fetchPlayerData(
    domain,
    subjectId,
    detailPath,
    usedSe,
    usedEp,
  );
  let normalized = normalizeStreamData(data, subjectId, usedSe, usedEp);

  // MovieBox movie metadata commonly reports season index 0. The old Pinflix
  // UI hard-coded season 1, so valid movies could appear unplayable.
  if (!normalized.has_resource && usedSe !== 0) {
    const fallback = await fetchPlayerData(domain, subjectId, detailPath, 0, 1);
    const fallbackNormalized = normalizeStreamData(
      fallback,
      subjectId,
      0,
      1,
    );
    if (fallbackNormalized.has_resource) {
      data = fallback;
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

  let streams = playData.streams || [];
  let dash = playData.dash || [];

  if (!streams.length && !dash.length && usedSe !== 0) {
    const fallback = await fetchPlayerData(domain, subjectId, detailPath, 0, 1);
    if ((fallback.streams || []).length || (fallback.dash || []).length) {
      playData = fallback;
      streams = fallback.streams || [];
      dash = fallback.dash || [];
      usedSe = 0;
      usedEp = 1;
    }
  }

  const first = streams[0] || dash[0];
  const streamId = first?.id;
  const streamFormat = first?.format || (streams.length ? "MP4" : "DASH");

  if (!streamId) {
    return {
      subject_id: subjectId,
      se: usedSe,
      ep: usedEp,
      count: 0,
      captions: [],
    };
  }

  const data = await movieboxRequest<any>("/subject/caption", {
    searchParams: {
      format: streamFormat,
      id: streamId,
      subjectId,
      detailPath,
    },
  });

  const inner = data?.data || {};
  const captions = Array.isArray(inner)
    ? inner
    : Array.isArray(inner?.captions)
      ? inner.captions
      : [];

  return {
    subject_id: subjectId,
    se: usedSe,
    ep: usedEp,
    count: captions.length,
    captions,
  };
}

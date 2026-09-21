import "server-only";

import { movieboxRequest, normalizeItem } from "./client";
import type {
  MovieBoxCategoryResponse,
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
            poster_url:
              item.image?.url || item.subject?.cover?.url || null,
            slug: item.detailPath || item.subject?.detailPath || null,
            subject_id: item.subject?.subjectId || null,
            badge: item.subject?.corner || null,
            kind: "mixed" as const,
          }));

        if (items.length) {
          sections.push({ section: "Banner", count: items.length, items });
        }
      } else if (
        ["SUBJECTS_MOVIE", "SUBJECTS_TV", "SUBJECTS_ANIMATION"].includes(
          opType,
        )
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
): Promise<MovieBoxCategoryResponse> {
  const data = await movieboxRequest<any>("/subject/filter", {
    method: "POST",
    body: {
      tabId,
      filter: {
        sort,
        genre: "ALL",
        country: "ALL",
        year: "ALL",
        language: "ALL",
      },
      page,
      perPage,
    },
  });

  const inner = data?.data || {};
  const rawItems = inner.items || inner.subjects || [];
  const items = rawItems.map((sub: any) => normalizeItem(sub));

  const pager = inner.pager || {};
  const total = pager.totalCount || inner.total || items.length;

  return {
    page,
    per_page: perPage,
    total,
    items,
  };
}

export async function getMovies(page = 1, sort = "RECOMMEND") {
  return getCategory(2, page, 24, sort);
}

export async function getTvSeries(page = 1, sort = "RECOMMEND") {
  return getCategory(5, page, 24, sort);
}

export async function getAnimation(page = 1, sort = "RECOMMEND") {
  return getCategory(8, page, 24, sort);
}

export async function search(query: string, page = 1) {
  try {
    const data = await movieboxRequest<any>("/subject/search", {
      method: "POST",
      body: {
        keyword: query,
        q: query,
        page,
        pageSize: 24,
        type: 0,
      },
    });

    const inner = data?.data || {};
    const rawItems = inner.items || inner.subjects || inner.list || [];
    const items = rawItems.map((sub: any) => normalizeItem(sub));

    return {
      query,
      page,
      items,
      total: inner.total || items.length,
    };
  } catch (primaryErr) {
    try {
      const data = await movieboxRequest<any>("/subject/search-suggest", {
        method: "POST",
        body: { keyword: query, perPage: 24 },
      });

      const inner = data?.data || {};
      const rawItems = inner.items || inner.subjects || inner.list || [];
      const items = rawItems.map((sub: any) => normalizeItem(sub));

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

export async function getStreamSources(
  subjectId: string | number,
  detailPath: string,
  se = 1,
  ep = 1,
): Promise<MovieBoxStreamResponse> {
  // 1. Resolve player domain
  const domData = await movieboxRequest<any>("/media-player/get-domain");
  const domain = String(domData?.data || "https://netfilm.world").replace(
    /\/$/,
    "",
  );

  // 2. Build the same Referer the real player uses
  const playerReferer =
    `${domain}/spa/videoPlayPage/movies/${detailPath}` +
    `?id=${subjectId}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`;

  const playUrl =
    `${domain}/wefeed-h5api-bff/subject/play` +
    `?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(detailPath)}`;

  const resp = await fetch(playUrl, {
    headers: {
      ...PLAYER_HEADERS,
      Referer: playerReferer,
    },
    next: { revalidate: 0 },
  });

  if (!resp.ok) {
    throw new Error(`Stream upstream error: ${resp.status}`);
  }

  const json = await resp.json();
  const data = json?.data || {};

  const hasResource = Boolean(data.hasResource);
  const sources = (data.streams || []).map((s: any) => ({
    quality: s.resolutions ? `${s.resolutions}p` : undefined,
    url: s.url,
    type: (s.format || "mp4").toLowerCase(),
    size: s.size,
    duration: s.duration,
    codec: s.codecName,
  }));

  return {
    sources,
    title: data.title,
    subtitles: [],
    // extra fields for debugging / UI
    ...({
      has_resource: hasResource,
      hls: data.hls || [],
      dash: data.dash || [],
      free_episodes: data.freeNum,
      limited: data.limited,
      note: hasResource ? null : "No stream found for this episode.",
    } as any),
  };
}

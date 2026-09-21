import "server-only";

import { movieboxRequest, normalizeItem } from "./client";
import type {
  MovieBoxCategoryResponse,
  MovieBoxHomeResponse,
  MovieBoxItem,
  MovieBoxSection,
} from "./types";

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
          .filter((item: any) => item?.title && !String(item.title).includes("Communities"))
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
}

export async function getDetail(slug: string) {
  // The original API uses /detail/{slug}. We try the most common patterns.
  // Many implementations resolve via subjectId. For now we return a basic shape
  // and let the stream endpoint handle the heavy lifting when subject_id is known.

  // Fallback: try to extract subject from slug if possible, otherwise return minimal
  return {
    title: slug
      .split("-")
      .slice(0, -1)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    slug,
    poster_url: null,
    description: null,
  };
}

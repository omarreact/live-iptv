import type {
  MovieBoxCategoryResponse,
  MovieBoxDetailView,
  MovieBoxHomeResponse,
  MovieBoxItem,
} from "@/lib/moviebox/types";
import type {
  MediaCatalogPage,
  MediaDetail,
  MediaHome,
  MediaItem,
  MediaKind,
} from "@/types/catalog";

function movieBoxKind(item: MovieBoxItem): MediaKind {
  if (item.kind === "movie" || item.kind === "series" || item.kind === "animation") {
    return item.kind;
  }
  return "mixed";
}

export function normalizeMovieBoxItem(item: MovieBoxItem): MediaItem {
  const fallbackId = item.slug ?? item.name;
  return {
    id: `moviebox:${String(item.subject_id ?? fallbackId)}`,
    source: "moviebox",
    kind: movieBoxKind(item),
    title: item.name,
    poster: item.poster_url,
    year: item.year ?? null,
    rating: item.rating ?? null,
    badge: item.badge ?? null,
    detailKey: item.slug,
  };
}

export function normalizeMovieBoxHome(home: MovieBoxHomeResponse): MediaHome {
  return {
    status: home.status,
    sections: home.sections.map((section) => ({
      title: section.section,
      items: section.items.map(normalizeMovieBoxItem),
    })),
    ...(home.error ? { error: home.error } : {}),
  };
}

export function normalizeMovieBoxCatalog(
  catalog: MovieBoxCategoryResponse,
): MediaCatalogPage {
  return {
    page: catalog.page,
    perPage: catalog.per_page,
    total: catalog.total,
    items: catalog.items.map(normalizeMovieBoxItem),
  };
}

export function normalizeMovieBoxMediaDetail(
  detail: MovieBoxDetailView,
  fallback: MovieBoxItem,
): MediaDetail {
  const base = normalizeMovieBoxItem(fallback);
  const genres = detail.genre
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const playback =
    detail.subjectId !== null && detail.subjectId !== undefined && detail.detailPath
      ? {
          provider: "moviebox",
          id: String(detail.subjectId),
          slug: detail.detailPath,
          defaultSeason: detail.seasons[0]?.se ?? 1,
          defaultEpisode: 1,
        }
      : null;

  return {
    ...base,
    id: `moviebox:${String(detail.subjectId ?? detail.detailPath ?? fallback.slug ?? fallback.name)}`,
    title: detail.title || fallback.name,
    poster: detail.poster ?? fallback.poster_url,
    year: detail.year ?? fallback.year ?? null,
    rating: detail.rating ?? fallback.rating ?? null,
    overview: detail.description,
    genres,
    trailer: detail.trailer,
    seasons: detail.seasons.map((season) => ({
      number: season.se,
      episodeCount: season.maxEp,
    })),
    playback,
  };
}

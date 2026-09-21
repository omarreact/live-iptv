import "server-only";

const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const REQUEST_TIMEOUT_MS = 8_000;

export type TmdbCatalogItem = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
  rating: number | null;
};

export type TmdbProvider = {
  name: string;
  logo: string | null;
  link: string | null;
};

export type TmdbCatalogDetail = TmdbCatalogItem & {
  tagline: string;
  genres: string[];
  runtime: number | null;
  seasons: number | null;
  episodes: number | null;
  cast: string[];
  trailer: string | null;
  providers: TmdbProvider[];
  watchLink: string | null;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function image(path: unknown, size: "w342" | "w780" | "original" = "w342"): string | null {
  const value = stringValue(path);
  return value ? `${IMAGE_BASE}/${size}${value}` : null;
}

function itemFrom(value: unknown, fallbackType?: "movie" | "tv"): TmdbCatalogItem | null {
  const item = record(value);
  const mediaType = item.media_type === "tv" || fallbackType === "tv" ? "tv" : "movie";
  const id = numberValue(item.id);
  if (!id) return null;

  return {
    id,
    mediaType,
    title: stringValue(mediaType === "tv" ? item.name : item.title) ?? "Untitled",
    overview: stringValue(item.overview) ?? "",
    poster: image(item.poster_path),
    backdrop: image(item.backdrop_path, "w780"),
    year:
      stringValue(mediaType === "tv" ? item.first_air_date : item.release_date)?.slice(0, 4) ??
      null,
    rating: numberValue(item.vote_average),
  };
}

function authHeaders(token: string | undefined): HeadersInit {
  return token
    ? { accept: "application/json", authorization: `Bearer ${token}` }
    : { accept: "application/json" };
}

async function tmdbRequest(path: string): Promise<unknown> {
  const token = process.env.TMDB_API_READ_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!token && !apiKey) throw new Error("TMDB credentials are not configured");

  const url = new URL(`${API_BASE}${path}`);
  if (!token && apiKey) url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    headers: authHeaders(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}`);
  return response.json();
}

function results(payload: unknown): TmdbCatalogItem[] {
  const raw = record(payload).results;
  return Array.isArray(raw)
    ? raw.map((item) => itemFrom(item)).filter((item): item is TmdbCatalogItem => item !== null)
    : [];
}

export async function getTmdbHome(): Promise<{
  sections: Array<{ title: string; items: TmdbCatalogItem[] }>;
  error?: string;
}> {
  try {
    const [trending, movies, shows] = await Promise.all([
      tmdbRequest("/trending/all/week?language=en-US"),
      tmdbRequest("/movie/popular?language=en-US&page=1"),
      tmdbRequest("/tv/popular?language=en-US&page=1"),
    ]);
    return {
      sections: [
        { title: "Trending this week", items: results(trending).slice(0, 18) },
        { title: "Popular movies", items: results(movies).slice(0, 18) },
        { title: "Popular TV shows", items: results(shows).slice(0, 18) },
      ],
    };
  } catch (error: unknown) {
    console.warn("[tmdb] home unavailable", error);
    return { sections: [], error: "Movie and show catalog is temporarily unavailable." };
  }
}

export async function searchTmdbCatalog(
  query: string,
  page = 1,
): Promise<{ items: TmdbCatalogItem[]; total: number; error?: string }> {
  try {
    const payload = await tmdbRequest(
      `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${page}`,
    );
    const root = record(payload);
    return {
      items: results(payload).filter(
        (item) => item.mediaType === "movie" || item.mediaType === "tv",
      ),
      total: numberValue(root.total_results) ?? 0,
    };
  } catch (error: unknown) {
    console.warn("[tmdb] search unavailable", error);
    return { items: [], total: 0, error: "Movie and show search is temporarily unavailable." };
  }
}

export async function getTmdbDetail(
  mediaType: "movie" | "tv",
  id: number,
): Promise<TmdbCatalogDetail | null> {
  try {
    const payload = await tmdbRequest(
      `/${mediaType}/${id}?language=en-US&append_to_response=credits,videos,watch/providers`,
    );
    const root = record(payload);
    const item = itemFrom({ ...root, media_type: mediaType }, mediaType);
    if (!item) return null;

    const credits = record(root.credits);
    const cast = Array.isArray(credits.cast)
      ? credits.cast
          .slice(0, 8)
          .map((person) => stringValue(record(person).name))
          .filter((name): name is string => Boolean(name))
      : [];
    const videoResults = record(root.videos).results;
    const videos: unknown[] = Array.isArray(videoResults) ? videoResults : [];
    const trailer = videos.find((video) => {
      const entry = record(video);
      return entry.site === "YouTube" && entry.type === "Trailer";
    });
    const providers = record(record(record(root["watch/providers"]).results).BD);
    const providerGroups = [
      ...(Array.isArray(providers.flatrate) ? providers.flatrate : []),
      ...(Array.isArray(providers.rent) ? providers.rent : []),
      ...(Array.isArray(providers.buy) ? providers.buy : []),
      ...(Array.isArray(providers.free) ? providers.free : []),
    ];
    const uniqueProviders = new Map<string, TmdbProvider>();
    for (const provider of providerGroups) {
      const entry = record(provider);
      const name = stringValue(entry.provider_name);
      if (name && !uniqueProviders.has(name)) {
        uniqueProviders.set(name, {
          name,
          logo: image(entry.logo_path),
          link: stringValue(providers.link),
        });
      }
    }

    return {
      ...item,
      tagline: stringValue(root.tagline) ?? "",
      genres: Array.isArray(root.genres)
        ? root.genres
            .map((genre) => stringValue(record(genre).name))
            .filter((name): name is string => Boolean(name))
        : [],
      runtime: numberValue(root.runtime),
      seasons: numberValue(root.number_of_seasons),
      episodes: numberValue(root.number_of_episodes),
      cast,
      trailer: stringValue(record(trailer).key)
        ? `https://www.youtube.com/watch?v=${record(trailer).key}`
        : null,
      providers: [...uniqueProviders.values()],
      watchLink: stringValue(providers.link),
    };
  } catch (error: unknown) {
    console.warn("[tmdb] details unavailable", error);
    return null;
  }
}

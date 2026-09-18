export type TmdbTitle = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
};

type TmdbSearchResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
};

type TmdbSearchResponse = { results?: TmdbSearchResult[] };

const BASE = "https://api.themoviedb.org/3";

/**
 * Optional metadata enrichment for EPG titles.
 * Set TMDB_API_READ_TOKEN (preferred) or TMDB_API_KEY in the deployment.
 * The app remains fully functional when neither is configured.
 */
export async function searchTmdbTitle(title: string): Promise<TmdbTitle | null> {
  const token = process.env.TMDB_API_READ_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!token && !apiKey) return null;

  const url = new URL(`${BASE}/search/multi`);
  url.searchParams.set("query", title);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");
  if (!token && apiKey) url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, {
    headers: token
      ? { accept: "application/json", authorization: `Bearer ${token}` }
      : { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 21_600 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as TmdbSearchResponse;
  const hit = data.results?.find((item) => item.media_type === "tv" || item.media_type === "movie");
  if (!hit || (hit.media_type !== "tv" && hit.media_type !== "movie")) return null;

  return {
    id: hit.id,
    mediaType: hit.media_type,
    title: hit.name ?? hit.title ?? title,
    overview: hit.overview ?? "",
    posterPath: hit.poster_path ?? null,
  };
}

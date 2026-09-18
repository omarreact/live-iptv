export type EntertainmentTitle = {
  id: string;
  source: "tmdb" | "tvmaze";
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  image: string | null;
  year: string | null;
  rating: number | null;
  href: string;
};

type TmdbItem = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
};

type TvMazeShow = {
  id: number;
  name?: string;
  summary?: string | null;
  premiered?: string | null;
  rating?: { average?: number | null };
  image?: { medium?: string | null; original?: string | null } | null;
  url?: string;
};

const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbAuth(): { headers: HeadersInit; apiKey: string | null } | null {
  const token = process.env.TMDB_API_READ_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim() ?? null;
  if (!token && !apiKey) return null;
  return {
    headers: token
      ? { accept: "application/json", authorization: `Bearer ${token}` }
      : { accept: "application/json" },
    apiKey,
  };
}

async function getTmdbTrending(): Promise<EntertainmentTitle[]> {
  const auth = tmdbAuth();
  if (!auth) return [];

  const url = new URL(`${TMDB_BASE}/trending/all/day`);
  url.searchParams.set("language", "en-US");
  if (!process.env.TMDB_API_READ_TOKEN?.trim() && auth.apiKey) {
    url.searchParams.set("api_key", auth.apiKey);
  }

  const response = await fetch(url, {
    headers: auth.headers,
    signal: AbortSignal.timeout(4_000),
    next: { revalidate: 900 },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { results?: TmdbItem[] };
  return (payload.results ?? [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 24)
    .map((item) => {
      const mediaType = item.media_type as "movie" | "tv";
      const date = mediaType === "movie" ? item.release_date : item.first_air_date;
      return {
        id: `tmdb-${mediaType}-${item.id}`,
        source: "tmdb" as const,
        mediaType,
        title: item.title ?? item.name ?? "Untitled",
        overview: item.overview ?? "",
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        year: date?.slice(0, 4) ?? null,
        rating: typeof item.vote_average === "number" ? item.vote_average : null,
        href: `https://www.themoviedb.org/${mediaType}/${item.id}`,
      };
    });
}

async function getTvMazePopular(): Promise<EntertainmentTitle[]> {
  const response = await fetch("https://api.tvmaze.com/shows?page=0", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(4_000),
    next: { revalidate: 3_600 },
  });
  if (!response.ok) return [];

  const shows = (await response.json()) as TvMazeShow[];
  return shows
    .filter((show) => show.name)
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0))
    .slice(0, 24)
    .map((show) => ({
      id: `tvmaze-tv-${show.id}`,
      source: "tvmaze" as const,
      mediaType: "tv" as const,
      title: show.name ?? "Untitled",
      overview: (show.summary ?? "").replace(/<[^>]+>/g, "").trim(),
      image: show.image?.original ?? show.image?.medium ?? null,
      year: show.premiered?.slice(0, 4) ?? null,
      rating: show.rating?.average ?? null,
      href: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
    }));
}

function key(title: EntertainmentTitle): string {
  return title.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function getEntertainmentHome(): Promise<{
  titles: EntertainmentTitle[];
  providers: string[];
}> {
  const [tmdb, tvmaze] = await Promise.all([
    getTmdbTrending().catch(() => []),
    getTvMazePopular().catch(() => []),
  ]);

  const merged: EntertainmentTitle[] = [];
  const seen = new Set<string>();

  for (const item of [...tmdb, ...tvmaze]) {
    const normalized = key(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(item);
    if (merged.length >= 36) break;
  }

  const providers = [
    ...(tmdb.length ? ["TMDB"] : []),
    ...(tvmaze.length ? ["TVmaze"] : []),
  ];

  return { titles: merged, providers };
}

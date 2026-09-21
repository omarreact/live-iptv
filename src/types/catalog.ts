export type MediaKind = "movie" | "series" | "animation" | "mixed";

export type MediaExternalIds = {
  tmdb?: string | number;
  imdb?: string;
  tvmaze?: string | number;
};

export type MediaItem = {
  id: string;
  source: string;
  kind: MediaKind;
  title: string;
  poster: string | null;
  year: string | null;
  rating: string | number | null;
  badge?: string | null;
  detailKey?: string | null;
  externalIds?: MediaExternalIds;
};

export type MediaSection = {
  title: string;
  items: MediaItem[];
};

export type MediaHome = {
  status: "success" | "error";
  sections: MediaSection[];
  error?: string;
};

export type MediaCatalogPage = {
  page: number;
  perPage: number;
  total: number;
  items: MediaItem[];
};

export type MediaSeason = {
  number: number;
  episodeCount: number;
};

export type MediaPlaybackRef = {
  provider: string;
  id: string;
  slug?: string;
  defaultSeason?: number;
  defaultEpisode?: number;
};

export type MediaDetail = MediaItem & {
  overview: string;
  genres: string[];
  trailer: string | null;
  backdrop?: string | null;
  seasons: MediaSeason[];
  playback: MediaPlaybackRef | null;
};

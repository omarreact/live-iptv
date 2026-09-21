export type MovieBoxKind = "movie" | "series" | "animation" | "mixed";

export type MovieBoxItem = {
  name: string;
  poster_url: string | null;
  slug: string | null;
  subject_id: string | number | null;
  badge?: string | null;
  rating?: number | string | null;
  year?: string | null;
  kind?: MovieBoxKind;
};

export type MovieBoxSection = {
  section: string;
  count: number;
  items: MovieBoxItem[];
};

export type MovieBoxHomeResponse = {
  status: "success" | "error";
  sections: MovieBoxSection[];
  error?: string;
};

export type MovieBoxCategoryResponse = {
  page: number;
  per_page: number;
  total: number;
  items: MovieBoxItem[];
};

export type MovieBoxDetail = {
  title: string;
  description?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  year?: string | null;
  rating?: number | string | null;
  genres?: string[];
  country?: string | null;
  runtime?: string | null;
  subject_id?: string | number | null;
  slug?: string | null;
  kind?: MovieBoxKind;
  seasons?: Array<{
    season: number;
    episodes: Array<{ episode: number; title?: string; subject_id?: string | number }>;
  }>;
};

export type MovieBoxStreamSource = {
  quality?: string;
  url: string;
  type?: "mp4" | "hls" | "dash" | string;
  headers?: Record<string, string>;
};

export type MovieBoxStreamResponse = {
  sources: MovieBoxStreamSource[];
  subtitles?: Array<{ language: string; url: string; label?: string }>;
  title?: string;
};

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

export type MovieBoxFilters = {
  genre?: string;
  country?: string;
  year?: string;
  language?: string;
};

export type MovieBoxCategoryResponse = {
  page: number;
  per_page: number;
  total: number;
  items: MovieBoxItem[];
};

export type MovieBoxStreamSource = {
  id?: string | number;
  quality?: string;
  url: string;
  type?: "mp4" | "hls" | "dash" | string;
  size?: string | number;
  duration?: number;
  codec?: string;
  headers?: Record<string, string>;
};

export type MovieBoxCaption = {
  language?: string;
  label?: string;
  url?: string;
  file?: string;
  src?: string;
  [key: string]: unknown;
};

export type MovieBoxStreamResponse = {
  sources: MovieBoxStreamSource[];
  subtitles?: MovieBoxCaption[];
  title?: string;
  subject_id?: string | number;
  se?: number;
  ep?: number;
  has_resource?: boolean;
  hls?: Array<Record<string, unknown>>;
  dash?: Array<Record<string, unknown>>;
  free_episodes?: number;
  limited?: boolean;
  note?: string | null;
};

export type MovieBoxCaptionResponse = {
  subject_id: string | number;
  se: number;
  ep: number;
  count: number;
  captions: MovieBoxCaption[];
};

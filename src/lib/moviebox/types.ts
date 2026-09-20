export type MovieBoxKind = "movie" | "series" | "mixed";

export type MovieBoxCatalogItem = {
  id: string;
  title: string;
  href: string;
  image: string | null;
  kind: MovieBoxKind;
  section: string;
};

export type MovieBoxCatalogRow = {
  id: string;
  title: string;
  kind: MovieBoxKind;
  items: MovieBoxCatalogItem[];
};

export type MovieBoxCatalogPayload = {
  source: "moviebox-public";
  fetchedAt: string;
  rows: MovieBoxCatalogRow[];
};

export type MovieBoxDetailPayload = {
  title: string;
  description: string;
  image: string | null;
  year: string | null;
  rating: number | null;
  runtime: string | null;
  genres: string[];
  href: string;
};

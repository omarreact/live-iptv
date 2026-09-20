export type ArchivePlayableItem = {
  identifier: string;
  title: string;
  description: string;
  year: string | null;
  creator: string | null;
  downloads: number | null;
  poster: string;
  licenseUrl: string;
  licenseLabel: string;
};

export type ArchiveCatalogPayload = {
  source: "internet-archive";
  fetchedAt: string;
  sort: "popular" | "latest";
  query: string;
  items: ArchivePlayableItem[];
};

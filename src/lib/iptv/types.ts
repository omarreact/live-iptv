export type SourceKind = "hls" | "mp4" | "ts";

export type StreamSource = {
  url: string;
  kind: SourceKind;
  host: string;
  score: number;
};

export type Channel = {
  id: string;
  name: string;
  normalizedName: string;
  logo: string;
  category: string;
  country: string | null;
  sources: StreamSource[];
};

export type PublicChannel = Omit<Channel, "sources" | "normalizedName"> & {
  sourceCount: number;
  sourceKinds: SourceKind[];
};

export type CatalogCategory = {
  name: string;
  slug: string;
  count: number;
};

export type Catalog = {
  channels: Channel[];
  categories: CatalogCategory[];
  fetchedAt: string;
  source: string;
};

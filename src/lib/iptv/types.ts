export type Stream = {
  id: string;
  url: string;
  title: string;
  feed: string | null;
  quality: string | null;
  label: string | null;
  geoBlocked: boolean;
  not247: boolean;
  userAgent: string | null;
  referrer: string | null;
};

export type Channel = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  url: string;
  groups: string[];
  country: string | null;
  quality: string | null;
  geoBlocked: boolean;
  not247: boolean;
  userAgent: string | null;
  referrer: string | null;
  network: string | null;
  altNames: string[];
  website: string | null;
  streams: Stream[];
};

export type Country = {
  code: string;
  name: string;
  count: number;
  flag?: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  count: number;
};

export type HomeData = {
  total: number;
  countryCount: number;
  featured: Channel[];
  rows: { category: Category; channels: Channel[] }[];
};

export type ChannelPage = {
  total: number;
  offset: number;
  channels: Channel[];
  title: string;
  subtitle: string;
  categoryCounts?: Record<string, number>;
};

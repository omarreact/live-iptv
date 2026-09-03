/** Raw shapes from https://iptv-org.github.io/api */

export type IptvOrgCategory = {
  id: string;
  name: string;
  description?: string;
};

export type IptvOrgCountry = {
  name: string;
  code: string;
  languages?: string[];
  flag?: string;
};

export type IptvOrgStream = {
  channel: string | null;
  feed?: string | null;
  title?: string;
  url: string;
  quality?: string | null;
  label?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  timeshift?: string | null;
  http_referrer?: string | null;
};

export type IptvOrgChannel = {
  id: string;
  name: string;
  alt_names?: string[];
  network?: string | null;
  owners?: string[];
  country: string;
  subdivision?: string | null;
  city?: string | null;
  broadcast_area?: string[];
  languages?: string[];
  categories?: string[];
  is_nsfw?: boolean;
  launched?: string | null;
  closed?: string | null;
  replaced_by?: string | null;
  website?: string | null;
  logo?: string;
  native_name?: string | null;
};

export type IptvOrgLogo = {
  channel: string;
  feed?: string | null;
  url: string;
  width?: number;
  height?: number;
  format?: string | null;
  in_use?: boolean;
};

/** Channel from iptv-org with its streams attached (server normalize step). */
export type AppChannel = IptvOrgChannel & {
  streams: IptvOrgStream[];
};

/** UI / player channel shape used across the app. */
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

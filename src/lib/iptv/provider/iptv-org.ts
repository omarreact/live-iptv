import { normalizeChannels, toUiChannel } from "../adapters/normalize";
import type {
  AppChannel,
  Channel,
  IptvOrgCategory,
  IptvOrgChannel,
  IptvOrgCountry,
  IptvOrgLogo,
  IptvOrgStream,
} from "../types";

const API_BASE = "https://iptv-org.github.io/api";
const REVALIDATE = 3600; // 1 hour — catalog changes slowly

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate: REVALIDATE, tags: ["iptv-org", `iptv-org:${path}`] },
  });
  if (!res.ok) {
    throw new Error(`iptv-org ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export type IptvCatalog = {
  channels: Channel[];
  byId: Map<string, Channel>;
  byCountry: Map<string, Channel[]>;
  byCategory: Map<string, Channel[]>;
  countries: IptvOrgCountry[];
  categories: IptvOrgCategory[];
  total: number;
};

/**
 * Single source of truth for the live catalog.
 * Next.js Data Cache stores the underlying JSON responses for `REVALIDATE` seconds.
 * Normalization runs once per cold miss (or after revalidation), not on every request.
 */
export async function getIptvCatalog(): Promise<IptvCatalog> {
  const [rawChannels, rawStreams, countries, categories, logos] = await Promise.all([
    fetchJson<IptvOrgChannel[]>("channels.json"),
    fetchJson<IptvOrgStream[]>("streams.json"),
    fetchJson<IptvOrgCountry[]>("countries.json"),
    fetchJson<IptvOrgCategory[]>("categories.json"),
    fetchJson<IptvOrgLogo[]>("logos.json").catch(() => [] as IptvOrgLogo[]),
  ]);

  const logoByChannel = new Map<string, string>();
  for (const logo of logos) {
    if (!logo.channel || !logo.url) continue;
    if (logo.in_use || !logoByChannel.has(logo.channel)) {
      logoByChannel.set(logo.channel, logo.url);
    }
  }

  const appChannels: AppChannel[] = normalizeChannels(rawChannels, rawStreams);
  const channels: Channel[] = appChannels.map((ch) =>
    toUiChannel(ch, logoByChannel.get(ch.id) ?? ch.logo ?? ""),
  );

  const byId = new Map<string, Channel>();
  const byCountry = new Map<string, Channel[]>();
  const byCategory = new Map<string, Channel[]>();

  for (const ch of channels) {
    byId.set(ch.id, ch);
    if (ch.country) {
      const list = byCountry.get(ch.country) ?? [];
      list.push(ch);
      byCountry.set(ch.country, list);
    }
    for (const group of ch.groups) {
      const list = byCategory.get(group) ?? [];
      list.push(ch);
      byCategory.set(group, list);
    }
  }

  return {
    channels,
    byId,
    byCountry,
    byCategory,
    countries,
    categories,
    total: channels.length,
  };
}

/** Country → channels, optionally filtered by category id (e.g. "news"). */
export async function getChannelsByCountry(
  code: string,
  category?: string,
): Promise<{
  country: IptvOrgCountry | null;
  channels: Channel[];
  categoryCounts: Record<string, number>;
  totalInCountry: number;
}> {
  const catalog = await getIptvCatalog();
  const key = code.toUpperCase();
  const country = catalog.countries.find((c) => c.code.toUpperCase() === key) ?? null;
  const all = catalog.byCountry.get(key) ?? [];

  const categoryCounts: Record<string, number> = {};
  for (const ch of all) {
    for (const g of ch.groups) {
      categoryCounts[g] = (categoryCounts[g] ?? 0) + 1;
    }
  }

  const cat = category?.trim().toLowerCase();
  const channels = cat ? all.filter((ch) => ch.groups.includes(cat)) : all;

  return { country, channels, categoryCounts, totalInCountry: all.length };
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const catalog = await getIptvCatalog();
  return catalog.byId.get(id) ?? null;
}

export async function getRelatedChannels(id: string, limit = 16): Promise<Channel[]> {
  const catalog = await getIptvCatalog();
  const channel = catalog.byId.get(id);
  if (!channel) return [];
  const category = channel.groups[0];
  const pool =
    (category ? catalog.byCategory.get(category) : null) ??
    (channel.country ? catalog.byCountry.get(channel.country) : null) ??
    catalog.channels;
  return pool.filter((other) => other.id !== id && !other.geoBlocked).slice(0, limit);
}

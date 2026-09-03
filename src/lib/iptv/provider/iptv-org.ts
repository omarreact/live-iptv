import { cache } from "react";
import {
  CATEGORY_META,
  FEATURED_NEEDLES,
  HOME_ROW_IDS,
  PRIMARY_CATEGORY_IDS,
  sortCategoryIds,
} from "../meta";
import { normalizeChannels, toUiChannel } from "../adapters/normalize";
import { sortChannels, sortCountriesByCount, type SortMode } from "../sort";
import type {
  AppChannel,
  Category,
  Channel,
  Country,
  HomeData,
  IptvOrgCategory,
  IptvOrgChannel,
  IptvOrgCountry,
  IptvOrgLogo,
  IptvOrgStream,
} from "../types";

const API_BASE = "https://iptv-org.github.io/api";
const REVALIDATE = 3600;
const FETCH_TIMEOUT_MS = 20_000;

let catalogCache: { expiresAt: number; value: IptvCatalog } | null = null;
let catalogInflight: Promise<IptvCatalog> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
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

async function buildIptvCatalog(): Promise<IptvCatalog> {
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

export const getIptvCatalog = cache(async function getIptvCatalog(): Promise<IptvCatalog> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.value;
  if (catalogInflight) return catalogInflight;

  catalogInflight = buildIptvCatalog();
  try {
    const value = await catalogInflight;
    catalogCache = { expiresAt: Date.now() + REVALIDATE * 1_000, value };
    return value;
  } finally {
    catalogInflight = null;
  }
});

function countryNameMap(catalog: IptvCatalog): Map<string, IptvOrgCountry> {
  const map = new Map<string, IptvOrgCountry>();
  for (const c of catalog.countries) map.set(c.code.toUpperCase(), c);
  return map;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWord(hay: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.includes(" ")) return hay.includes(needle);
  return new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:[^a-z0-9]|$)`, "i").test(hay);
}

function pickFeatured(channels: Channel[]): Channel[] {
  const seen = new Set<string>();
  const out: Channel[] = [];
  const searchable = channels.map((ch) => ({
    ch,
    text: `${ch.shortName} ${ch.name} ${ch.altNames.join(" ")}`.toLowerCase(),
  }));
  for (const needle of FEATURED_NEEDLES) {
    const hit = searchable.find(
      ({ ch, text }) => !seen.has(ch.id) && !ch.geoBlocked && containsWord(text, needle),
    );
    if (hit) {
      seen.add(hit.ch.id);
      out.push(hit.ch);
    }
    if (out.length >= 12) break;
  }
  return out;
}

export async function getHomeData(): Promise<HomeData> {
  const catalog = await getIptvCatalog();
  const rows = HOME_ROW_IDS.map((id) => {
    const meta = CATEGORY_META[id];
    const list = catalog.byCategory.get(id) ?? [];
    return {
      category: {
        id,
        name: meta?.name ?? id,
        description: meta?.description ?? "",
        count: list.length,
      },
      channels: sortChannels(
        list.filter((ch) => !ch.geoBlocked),
        "default",
      ).slice(0, 18),
    };
  }).filter((row) => row.channels.length > 0);

  return {
    total: catalog.total,
    countryCount: catalog.byCountry.size,
    featured: pickFeatured(catalog.channels),
    rows,
  };
}

export async function searchChannels(q: string, limit = 60): Promise<Channel[]> {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const catalog = await getIptvCatalog();
  const names = countryNameMap(catalog);
  const ranked: { ch: Channel; score: number }[] = [];

  for (const ch of catalog.channels) {
    const fields = [ch.shortName, ch.name, ...ch.altNames, ch.network ?? ""].map((v) =>
      v.toLowerCase(),
    );
    const countryName = ch.country ? (names.get(ch.country)?.name ?? "").toLowerCase() : "";
    let score = 0;
    if (fields.some((v) => v === query)) score = 100;
    else if (fields.some((v) => v.startsWith(query))) score = 90;
    else if (fields.some((v) => containsWord(v, query))) score = 80;
    else if (fields.some((v) => v.includes(query))) score = 50;
    else if (ch.groups.some((g) => g === query || containsWord(g, query))) score = 30;
    else if (ch.country?.toLowerCase() === query || countryName.includes(query)) score = 25;
    if (score > 0) ranked.push({ ch, score });
  }

  ranked.sort((a, b) => b.score - a.score || a.ch.shortName.localeCompare(b.ch.shortName));
  return ranked.slice(0, limit).map(({ ch }) => ch);
}

export async function getChannelsByCountry(
  code: string,
  category?: string,
  sort: SortMode = "default",
) {
  const catalog = await getIptvCatalog();
  const key = code.toUpperCase();
  const country = catalog.countries.find((c) => c.code.toUpperCase() === key) ?? null;
  const all = catalog.byCountry.get(key) ?? [];

  const categoryCounts: Record<string, number> = {};
  for (const ch of all) {
    for (const g of ch.groups) {
      if (!CATEGORY_META[g]) continue;
      categoryCounts[g] = (categoryCounts[g] ?? 0) + 1;
    }
  }

  const categoryIds = sortCategoryIds(Object.keys(categoryCounts), categoryCounts);
  const cat = category?.trim().toLowerCase();
  const filtered = cat ? all.filter((ch) => ch.groups.includes(cat)) : all;

  return {
    country,
    channels: sortChannels(filtered, sort),
    categoryCounts,
    categoryIds,
    totalInCountry: all.length,
    sort,
  };
}

export async function getChannelsByCategory(
  categoryId: string,
  countryCode?: string,
  sort: SortMode = "default",
) {
  const catalog = await getIptvCatalog();
  const key = categoryId.trim().toLowerCase();
  const meta = CATEGORY_META[key];
  const all = catalog.byCategory.get(key) ?? [];
  const names = countryNameMap(catalog);

  const byCode = new Map<string, number>();
  for (const ch of all) {
    if (!ch.country) continue;
    byCode.set(ch.country, (byCode.get(ch.country) ?? 0) + 1);
  }

  const countryCounts = sortCountriesByCount(
    [...byCode.entries()].map(([code, count]) => {
      const info = names.get(code);
      return { code, name: info?.name ?? code, flag: info?.flag, count };
    }),
  );

  const cc = countryCode?.trim().toUpperCase();
  const filtered = cc ? all.filter((ch) => ch.country === cc) : all;
  const category: Category | null = meta
    ? { id: key, name: meta.name, description: meta.description, count: all.length }
    : all.length
      ? { id: key, name: key, description: "", count: all.length }
      : null;

  return {
    category,
    channels: sortChannels(filtered, sort),
    countryCounts,
    totalInCategory: all.length,
    sort,
  };
}

export async function getGuideSummary() {
  const catalog = await getIptvCatalog();
  const names = countryNameMap(catalog);
  const primarySet = new Set<string>(PRIMARY_CATEGORY_IDS);
  const primaryCategories: Category[] = [];
  const otherCategories: Category[] = [];

  for (const id of PRIMARY_CATEGORY_IDS) {
    const list = catalog.byCategory.get(id) ?? [];
    if (!list.length || !CATEGORY_META[id]) continue;
    primaryCategories.push({
      id,
      name: CATEGORY_META[id].name,
      description: CATEGORY_META[id].description,
      count: list.length,
    });
  }

  for (const [id, list] of catalog.byCategory) {
    if (primarySet.has(id) || !CATEGORY_META[id] || !list.length) continue;
    otherCategories.push({
      id,
      name: CATEGORY_META[id].name,
      description: CATEGORY_META[id].description,
      count: list.length,
    });
  }
  otherCategories.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const countries: Country[] = sortCountriesByCount(
    [...catalog.byCountry.entries()].map(([code, list]) => ({
      code,
      name: names.get(code)?.name ?? code,
      count: list.length,
      flag: names.get(code)?.flag,
    })),
  );

  return { total: catalog.total, primaryCategories, otherCategories, countries };
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const catalog = await getIptvCatalog();
  return catalog.byId.get(id) ?? null;
}

export async function getRelatedChannels(id: string, limit = 16): Promise<Channel[]> {
  const catalog = await getIptvCatalog();
  const channel = catalog.byId.get(id);
  if (!channel) return [];
  const category = channel.groups.find((g) => CATEGORY_META[g]) ?? channel.groups[0];
  const pool =
    (category ? catalog.byCategory.get(category) : null) ??
    (channel.country ? catalog.byCountry.get(channel.country) : null) ??
    catalog.channels;
  return sortChannels(
    pool.filter((other) => other.id !== id && !other.geoBlocked),
    "default",
  ).slice(0, limit);
}

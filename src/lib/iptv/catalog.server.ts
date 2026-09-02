import { CATEGORY_META, FEATURED_NEEDLES, HOME_ROW_IDS, categoryKey } from "./meta";
import { parseM3u } from "./parse";
import type { Category, Channel, ChannelPage, Country, HomeData } from "./types";

const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const COUNTRIES_URL = "https://iptv-org.github.io/api/countries.json";
const TTL_MS = 10 * 60 * 1000;

type CountryInfo = { name: string; code: string };

type Catalog = {
  channels: Channel[];
  byId: Map<string, Channel>;
  byCategory: Map<string, Channel[]>;
  byCountry: Map<string, Channel[]>;
  categories: Category[];
  countries: Country[];
  countryNames: Map<string, string>;
};

let cache: { at: number; data: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { accept: "*/*" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Failed to fetch playlist (${res.status})`);
  return res.text();
}

function buildCatalog(m3u: string, countryList: CountryInfo[]): Catalog {
  const channels = parseM3u(m3u);
  const byId = new Map<string, Channel>();
  const byCategory = new Map<string, Channel[]>();
  const byCountry = new Map<string, Channel[]>();
  const countryNames = new Map<string, string>();

  for (const c of countryList) {
    countryNames.set(c.code.toUpperCase(), c.name);
  }

  for (const ch of channels) {
    if (!byId.has(ch.id)) byId.set(ch.id, ch);
    for (const g of ch.groups) {
      const key = categoryKey(g);
      if (key === "xxx") continue;
      const list = byCategory.get(key);
      if (list) list.push(ch);
      else byCategory.set(key, [ch]);
    }
    if (ch.country) {
      const list = byCountry.get(ch.country);
      if (list) list.push(ch);
      else byCountry.set(ch.country, [ch]);
    }
  }

  const categories: Category[] = Object.entries(CATEGORY_META)
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      description: meta.description,
      count: byCategory.get(id)?.length ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const countries: Country[] = [...byCountry.entries()]
    .map(([code, list]) => ({
      code,
      name: countryNames.get(code) ?? code,
      count: list.length,
    }))
    .sort((a, b) => b.count - a.count);

  return { channels, byId, byCategory, byCountry, categories, countries, countryNames };
}

export async function loadCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [m3u, countriesRaw] = await Promise.all([
        fetchText(PLAYLIST_URL),
        fetch(COUNTRIES_URL, { signal: AbortSignal.timeout(15000) }).then((r) => {
          if (!r.ok) throw new Error("Failed to fetch countries");
          return r.json() as Promise<CountryInfo[]>;
        }),
      ]);
      const data = buildCatalog(m3u, countriesRaw);
      cache = { at: Date.now(), data };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
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
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: Channel[] = [];
  const lower = channels.map((ch) => ({ ch, n: ch.shortName.toLowerCase() }));

  const take = (ch: Channel) => {
    const name = ch.shortName.toLowerCase();
    if (seenIds.has(ch.id) || seenNames.has(name)) return false;
    seenIds.add(ch.id);
    seenNames.add(name);
    out.push(ch);
    return true;
  };

  for (const needle of FEATURED_NEEDLES) {
    const hit = lower.find(
      ({ ch, n }) =>
        !seenIds.has(ch.id) &&
        !seenNames.has(ch.shortName.toLowerCase()) &&
        !ch.geoBlocked &&
        containsWord(n, needle) &&
        (ch.quality === "1080p" || ch.quality === "720p" || !ch.quality),
    );
    if (hit) take(hit.ch);
    if (out.length >= 12) break;
  }

  if (out.length < 8) {
    for (const ch of channels) {
      if (ch.geoBlocked || !ch.logo) continue;
      if (!ch.groups.some((g) => g.toLowerCase() === "news")) continue;
      take(ch);
      if (out.length >= 8) break;
    }
  }
  return out;
}

export async function getHomeData(): Promise<HomeData> {
  const cat = await loadCatalog();
  const rows = HOME_ROW_IDS.map((id) => {
    const meta = CATEGORY_META[id];
    const list = cat.byCategory.get(id) ?? [];
    return {
      category: {
        id,
        name: meta?.name ?? id,
        description: meta?.description ?? "",
        count: list.length,
      },
      channels: list.filter((c) => !c.geoBlocked).slice(0, 18),
    };
  }).filter((row) => row.channels.length > 0);

  return {
    total: cat.channels.length,
    countryCount: cat.countries.length,
    featured: pickFeatured(cat.channels),
    rows,
  };
}

export async function getBrowseData(): Promise<{
  categories: Category[];
  countries: Country[];
  total: number;
}> {
  const cat = await loadCatalog();
  return {
    categories: cat.categories,
    countries: cat.countries,
    total: cat.channels.length,
  };
}

export async function getCategoryPage(
  id: string,
  offset = 0,
  limit = 96,
): Promise<ChannelPage> {
  const cat = await loadCatalog();
  const key = categoryKey(id);
  const list = cat.byCategory.get(key) ?? [];
  const meta = CATEGORY_META[key];
  return {
    total: list.length,
    offset,
    channels: list.slice(offset, offset + limit),
    title: meta?.name ?? id,
    subtitle: meta?.description ?? `${list.length} live channels`,
  };
}

export async function getCountryPage(
  code: string,
  offset = 0,
  limit = 96,
): Promise<ChannelPage> {
  const cat = await loadCatalog();
  const key = code.toUpperCase();
  const list = cat.byCountry.get(key) ?? [];
  const name = cat.countryNames.get(key) ?? key;
  return {
    total: list.length,
    offset,
    channels: list.slice(offset, offset + limit),
    title: name,
    subtitle: `${list.length} live channels`,
  };
}

export async function searchChannels(q: string, limit = 60): Promise<Channel[]> {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const cat = await loadCatalog();
  const ranked: { ch: Channel; score: number }[] = [];

  for (const ch of cat.channels) {
    const name = ch.shortName.toLowerCase();
    const full = ch.name.toLowerCase();
    const countryName = ch.country ? (cat.countryNames.get(ch.country) ?? "").toLowerCase() : "";
    let score = 0;
    if (name === query || full === query) score = 100;
    else if (name.startsWith(query) || full.startsWith(query)) score = 90;
    else if (containsWord(name, query) || containsWord(full, query)) score = 80;
    else if (name.includes(query) || full.includes(query)) score = 50;
    else if (ch.groups.some((g) => g.toLowerCase() === query || containsWord(g.toLowerCase(), query))) score = 30;
    else if (ch.country && ch.country.toLowerCase() === query) score = 25;
    else if (query.length >= 3 && countryName.includes(query)) score = 20;
    if (score > 0) ranked.push({ ch, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => r.ch);
}

export async function getChannel(id: string): Promise<Channel | null> {
  const cat = await loadCatalog();
  return cat.byId.get(id) ?? null;
}

export async function getRelated(id: string, limit = 16): Promise<Channel[]> {
  const cat = await loadCatalog();
  const ch = cat.byId.get(id);
  if (!ch) return [];
  const primary = ch.groups[0] ? categoryKey(ch.groups[0]) : "";
  const pool = (primary ? cat.byCategory.get(primary) : null) ?? cat.channels;
  const out: Channel[] = [];
  for (const other of pool) {
    if (other.id === id) continue;
    out.push(other);
    if (out.length >= limit) break;
  }
  return out;
}

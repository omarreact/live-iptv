import { CATEGORY_META, FEATURED_NEEDLES, HOME_ROW_IDS, categoryKey } from "./meta";
import { parseM3u } from "./parse";
import type { Category, Channel, ChannelPage, Country, HomeData, Stream } from "./types";

const API_BASE = "https://iptv-org.github.io/api";
const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const TTL_MS = 10 * 60 * 1000;

type ApiChannel = { id: string; name: string; alt_names?: string[]; network?: string | null; country: string; categories?: string[]; is_nsfw?: boolean; website?: string | null };
type ApiStream = { channel: string | null; feed?: string | null; title: string; url: string; referrer?: string | null; user_agent?: string | null; quality?: string | null; label?: string | null };
type ApiLogo = { channel: string; feed?: string | null; in_use?: boolean; url: string };
type CountryInfo = { name: string; code: string; flag?: string };
type Catalog = { channels: Channel[]; byId: Map<string, Channel>; byCategory: Map<string, Channel[]>; byCountry: Map<string, Channel[]>; categories: Category[]; countries: Country[]; countryNames: Map<string, string> };

let cache: { at: number; data: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;

async function fetchJson<T>(path: string, timeout = 20000): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Failed to fetch iptv-org ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { accept: "*/*" }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`Failed to fetch playlist (${res.status})`);
  return res.text();
}

function streamIsUsable(stream: ApiStream): boolean {
  return /^https?:\/\//i.test(stream.url) && !/\.mpd(?:\?|#|$)/i.test(stream.url) && !/youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com/i.test(stream.url);
}

function streamFlags(stream: ApiStream) {
  const label = stream.label ?? "";
  return { geoBlocked: /geo[- ]?blocked/i.test(label), not247: /not\s*24\s*\/\s*7/i.test(label) };
}

function qualityScore(quality: string | null): number {
  const match = quality?.match(/(\d{3,4})p/i);
  return match ? Number(match[1]) : 0;
}

function rankStreams(streams: Stream[]): Stream[] {
  return [...streams].sort((a, b) => {
    const blocked = Number(a.geoBlocked || a.not247) - Number(b.geoBlocked || b.not247);
    return blocked || qualityScore(b.quality) - qualityScore(a.quality);
  });
}

function chooseLogo(channelId: string, logos: ApiLogo[]): string {
  const matches = logos.filter((logo) => logo.channel === channelId && logo.url);
  return matches.find((logo) => logo.in_use)?.url ?? matches[0]?.url ?? "";
}

function buildCatalog(apiChannels: ApiChannel[], apiStreams: ApiStream[], countryList: CountryInfo[], logos: ApiLogo[]): Catalog {
  const streamsByChannel = new Map<string, Stream[]>();
  for (const raw of apiStreams) {
    if (!raw.channel || !streamIsUsable(raw)) continue;
    const flags = streamFlags(raw);
    const stream: Stream = {
      id: `${raw.channel}:${raw.feed ?? "main"}:${raw.url}`,
      url: raw.url,
      title: raw.title || "Live stream",
      feed: raw.feed ?? null,
      quality: raw.quality ?? null,
      label: raw.label ?? null,
      geoBlocked: flags.geoBlocked,
      not247: flags.not247,
      userAgent: raw.user_agent ?? null,
      referrer: raw.referrer ?? null,
    };
    const list = streamsByChannel.get(raw.channel);
    if (list) list.push(stream);
    else streamsByChannel.set(raw.channel, [stream]);
  }

  const byId = new Map<string, Channel>();
  const byCategory = new Map<string, Channel[]>();
  const byCountry = new Map<string, Channel[]>();
  const countryNames = new Map<string, string>();
  for (const country of countryList) countryNames.set(country.code.toUpperCase(), country.name);

  const channels: Channel[] = [];
  for (const raw of apiChannels) {
    if (raw.is_nsfw) continue;
    const streams = rankStreams(streamsByChannel.get(raw.id) ?? []);
    if (!streams.length) continue;
    const groups = (raw.categories ?? []).map(categoryKey).filter((id) => id !== "xxx");
    const primary = streams[0];
    const channel: Channel = {
      id: raw.id,
      name: raw.name,
      shortName: raw.name,
      logo: chooseLogo(raw.id, logos),
      url: primary.url,
      groups,
      country: raw.country?.toUpperCase() ?? null,
      quality: primary.quality,
      geoBlocked: primary.geoBlocked,
      not247: primary.not247,
      userAgent: primary.userAgent,
      referrer: primary.referrer,
      network: raw.network ?? null,
      altNames: raw.alt_names ?? [],
      website: raw.website ?? null,
      streams,
    };
    channels.push(channel);
    byId.set(channel.id, channel);
    for (const group of groups) {
      if (!CATEGORY_META[group]) continue;
      const list = byCategory.get(group);
      if (list) list.push(channel); else byCategory.set(group, [channel]);
    }
    if (channel.country) {
      const list = byCountry.get(channel.country);
      if (list) list.push(channel); else byCountry.set(channel.country, [channel]);
    }
  }

  const categories = Object.entries(CATEGORY_META)
    .map(([id, meta]) => ({ id, name: meta.name, description: meta.description, count: byCategory.get(id)?.length ?? 0 }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count);
  const countries = [...byCountry.entries()]
    .map(([code, list]) => ({ code, name: countryNames.get(code) ?? code, count: list.length, flag: countryList.find((c) => c.code.toUpperCase() === code)?.flag }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { channels, byId, byCategory, byCountry, categories, countries, countryNames };
}

async function loadFromApi(): Promise<Catalog> {
  const [channels, streams, countries, logos] = await Promise.all([
    fetchJson<ApiChannel[]>("channels.json"),
    fetchJson<ApiStream[]>("streams.json"),
    fetchJson<CountryInfo[]>("countries.json"),
    fetchJson<ApiLogo[]>("logos.json"),
  ]);
  return buildCatalog(channels, streams, countries, logos);
}

async function loadFallback(): Promise<Catalog> {
  const [m3u, countries] = await Promise.all([fetchText(PLAYLIST_URL), fetchJson<CountryInfo[]>("countries.json")]);
  const parsed = parseM3u(m3u);
  const channels: ApiChannel[] = parsed.map((channel) => ({ id: channel.id, name: channel.shortName, country: channel.country ?? "", categories: channel.groups, is_nsfw: false }));
  const streams: ApiStream[] = parsed.map((channel) => ({ channel: channel.id, title: channel.name, url: channel.url, quality: channel.quality, referrer: channel.referrer, user_agent: channel.userAgent, label: channel.geoBlocked ? "Geo-blocked" : channel.not247 ? "Not 24/7" : null }));
  const logos: ApiLogo[] = parsed.filter((channel) => channel.logo).map((channel) => ({ channel: channel.id, url: channel.logo, in_use: true }));
  return buildCatalog(channels, streams, countries, logos);
}

export async function loadCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      let data: Catalog;
      try { data = await loadFromApi(); }
      catch (error) { console.warn("iptv-org structured API failed; using M3U fallback", error); data = await loadFallback(); }
      cache = { at: Date.now(), data };
      return data;
    } finally { inflight = null; }
  })();
  return inflight;
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function containsWord(hay: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.includes(" ")) return hay.includes(needle);
  return new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:[^a-z0-9]|$)`, "i").test(hay);
}

function pickFeatured(channels: Channel[]): Channel[] {
  const seen = new Set<string>();
  const out: Channel[] = [];
  const searchable = channels.map((ch) => ({ ch, text: `${ch.shortName} ${ch.name} ${ch.altNames.join(" ")}`.toLowerCase() }));
  for (const needle of FEATURED_NEEDLES) {
    const hit = searchable.find(({ ch, text }) => !seen.has(ch.id) && !ch.geoBlocked && containsWord(text, needle));
    if (hit) { seen.add(hit.ch.id); out.push(hit.ch); }
    if (out.length >= 12) break;
  }
  return out;
}

export async function getHomeData(): Promise<HomeData> {
  const cat = await loadCatalog();
  const rows = HOME_ROW_IDS.map((id) => {
    const meta = CATEGORY_META[id];
    const list = cat.byCategory.get(id) ?? [];
    return { category: { id, name: meta?.name ?? id, description: meta?.description ?? "", count: list.length }, channels: list.filter((channel) => !channel.geoBlocked).slice(0, 18) };
  }).filter((row) => row.channels.length > 0);
  return { total: cat.channels.length, countryCount: cat.countries.length, featured: pickFeatured(cat.channels), rows };
}

export async function getBrowseData(): Promise<{ categories: Category[]; countries: Country[]; total: number }> {
  const cat = await loadCatalog();
  return { categories: cat.categories, countries: cat.countries, total: cat.channels.length };
}

export async function getCategoryPage(id: string, offset = 0, limit = 96): Promise<ChannelPage> {
  const cat = await loadCatalog();
  const key = categoryKey(id);
  const list = cat.byCategory.get(key) ?? [];
  const meta = CATEGORY_META[key];
  return { total: list.length, offset, channels: list.slice(offset, offset + limit), title: meta?.name ?? id, subtitle: meta?.description ?? `${list.length} live channels` };
}

export async function getCountryPage(code: string, offset = 0, limit = 96, category?: string): Promise<ChannelPage> {
  const cat = await loadCatalog();
  const key = code.toUpperCase();
  const all = cat.byCountry.get(key) ?? [];
  const categoryKeyValue = category ? categoryKey(category) : "";
  const list = categoryKeyValue && CATEGORY_META[categoryKeyValue]
    ? all.filter((channel) => channel.groups.includes(categoryKeyValue))
    : all;
  const categoryCounts = Object.fromEntries(
    cat.categories
      .map((item) => [item.id, all.filter((channel) => channel.groups.includes(item.id)).length] as const)
      .filter(([, count]) => count > 0),
  );
  const name = cat.countryNames.get(key) ?? key;
  const title = categoryKeyValue && CATEGORY_META[categoryKeyValue]
    ? `${name} · ${CATEGORY_META[categoryKeyValue].name}`
    : name;
  const subtitle = categoryKeyValue && CATEGORY_META[categoryKeyValue]
    ? `${list.length} ${CATEGORY_META[categoryKeyValue].name.toLowerCase()} channels`
    : `${list.length} live channels`;
  return { total: list.length, offset, channels: list.slice(offset, offset + limit), title, subtitle, categoryCounts };
}

export async function searchChannels(q: string, limit = 60): Promise<Channel[]> {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const cat = await loadCatalog();
  const ranked: { ch: Channel; score: number }[] = [];
  for (const ch of cat.channels) {
    const fields = [ch.shortName, ch.name, ...ch.altNames, ch.network ?? ""].map((value) => value.toLowerCase());
    const countryName = ch.country ? (cat.countryNames.get(ch.country) ?? "").toLowerCase() : "";
    let score = 0;
    if (fields.some((value) => value === query)) score = 100;
    else if (fields.some((value) => value.startsWith(query))) score = 90;
    else if (fields.some((value) => containsWord(value, query))) score = 80;
    else if (fields.some((value) => value.includes(query))) score = 50;
    else if (ch.groups.some((group) => group === query || containsWord(group, query))) score = 30;
    else if (ch.country?.toLowerCase() === query || countryName.includes(query)) score = 25;
    if (score > 0) ranked.push({ ch, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.ch.shortName.localeCompare(b.ch.shortName));
  return ranked.slice(0, limit).map(({ ch }) => ch);
}

export async function getChannel(id: string): Promise<Channel | null> {
  const cat = await loadCatalog();
  return cat.byId.get(id) ?? null;
}

export async function getRelated(id: string, limit = 16): Promise<Channel[]> {
  const cat = await loadCatalog();
  const channel = cat.byId.get(id);
  if (!channel) return [];
  const category = channel.groups.find((group) => CATEGORY_META[group]);
  const pool = (category ? cat.byCategory.get(category) : null) ?? cat.byCountry.get(channel.country ?? "") ?? cat.channels;
  return pool.filter((other) => other.id !== id && !other.geoBlocked).slice(0, limit);
}

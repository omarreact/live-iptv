import { parseM3u, categorySlug } from "./m3u";
import type { Catalog, Channel, PublicChannel } from "./types";

const DEFAULT_PLAYLIST =
  "https://gist.githubusercontent.com/Syed-Bipul-Rahman/09a05c101a5a1610e7bcd70c9b0e5c07/raw/test-iptv.m3u";
const PINNED_FALLBACK =
  "https://gist.githubusercontent.com/Syed-Bipul-Rahman/09a05c101a5a1610e7bcd70c9b0e5c07/raw/7d95bf13463c313ecdb090ad6d05851e834cce7b/test-iptv.m3u";
const PUBLIC_PLAYLIST = "https://iptv-org.github.io/iptv/index.m3u";
const CURATED_FREE_PLAYLISTS = [
  "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
  "https://raw.githubusercontent.com/freecasthub/public-iptv/main/playlist.m3u",
] as const;
const CACHE_MS = 5 * 60_000;

let memory: { expiresAt: number; catalog: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;
const localMemory = new Map<string, { expiresAt: number; catalog: Catalog }>();
const localInflight = new Map<string, Promise<Catalog>>();

async function downloadPlaylist(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain;q=0.9, */*;q=0.5",
      "user-agent": "Live-IPTV/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Playlist fetch failed with HTTP " + String(response.status));
  const text = await response.text();
  if (!text.includes("#EXTINF")) throw new Error("Playlist response is not M3U data");
  return text;
}

function mergeLocalCatalogs(
  catalogs: Array<{ catalog: Catalog; priority: number; forceCountry?: string }>,
  countryCode: string,
): Catalog {
  const merged = new Map<string, Channel>();

  for (const { catalog, priority, forceCountry } of catalogs) {
    for (const channel of catalog.channels) {
      const country = (channel.country || forceCountry || "").toUpperCase();
      if (country !== countryCode) continue;

      const sources = channel.sources.map((source) => ({
        ...source,
        score: source.score + priority,
      }));
      const existing = merged.get(channel.normalizedName);

      if (!existing) {
        merged.set(channel.normalizedName, {
          ...channel,
          country: countryCode,
          sources: [...sources].sort((a, b) => b.score - a.score).slice(0, 8),
        });
        continue;
      }

      for (const source of sources) {
        if (!existing.sources.some((item) => item.url === source.url) && existing.sources.length < 8) {
          existing.sources.push(source);
        }
      }
      existing.sources.sort((a, b) => b.score - a.score);
      if (!existing.logo && channel.logo) existing.logo = channel.logo;
      if (existing.category === "Other" && channel.category !== "Other") existing.category = channel.category;
    }
  }

  const channels = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  const countByCategory = new Map<string, number>();
  for (const channel of channels) {
    countByCategory.set(channel.category, (countByCategory.get(channel.category) || 0) + 1);
  }

  return {
    channels,
    categories: [...countByCategory.entries()]
      .map(([name, count]) => ({ name, slug: categorySlug(name), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    fetchedAt: new Date().toISOString(),
    source: catalogs.map((item) => item.catalog.source).join(" + "),
  };
}

async function buildLocalCatalog(countryCode: string): Promise<Catalog> {
  const countryPlaylist = `https://iptv-org.github.io/iptv/countries/${countryCode.toLowerCase()}.m3u`;
  const sources = [
    ...CURATED_FREE_PLAYLISTS.map((url, index) => ({
      url,
      priority: 60 - index * 10,
      forceCountry: undefined as string | undefined,
    })),
    { url: countryPlaylist, priority: 20, forceCountry: countryCode },
  ];

  const results = await Promise.allSettled(
    sources.map(async (source) => ({
      ...source,
      text: await downloadPlaylist(source.url),
    })),
  );

  const catalogs: Array<{ catalog: Catalog; priority: number; forceCountry?: string }> = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { url, priority, forceCountry, text } = result.value;
    const catalog = parseM3u(text, url);
    if (catalog.channels.length) catalogs.push({ catalog, priority, forceCountry });
  }

  if (!catalogs.length) {
    return {
      channels: [],
      categories: [],
      fetchedAt: new Date().toISOString(),
      source: "local-unavailable",
    };
  }

  return mergeLocalCatalogs(catalogs, countryCode);
}

export async function getLocalCatalog(countryCode: string): Promise<Catalog> {
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return {
      channels: [],
      categories: [],
      fetchedAt: new Date().toISOString(),
      source: "invalid-country",
    };
  }

  const cached = localMemory.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.catalog;

  const pending = localInflight.get(normalized);
  if (pending) return pending;

  const promise = buildLocalCatalog(normalized);
  localInflight.set(normalized, promise);
  try {
    const catalog = await promise;
    localMemory.set(normalized, { expiresAt: Date.now() + CACHE_MS, catalog });
    return catalog;
  } finally {
    localInflight.delete(normalized);
  }
}

async function buildCatalog(): Promise<Catalog> {
  const primary = process.env.IPTV_PLAYLIST_URL?.trim() || DEFAULT_PLAYLIST;
  const fallback = process.env.IPTV_PLAYLIST_FALLBACK_URL?.trim() || PINNED_FALLBACK;
  const publicPlaylist = process.env.IPTV_PUBLIC_PLAYLIST_URL?.trim() || PUBLIC_PLAYLIST;
  const candidates = [...new Set([primary, fallback, publicPlaylist])];

  const playlists: string[] = [];
  const loadedSources: string[] = [];
  let lastError: unknown = null;

  for (const url of candidates) {
    try {
      const text = await downloadPlaylist(url);
      playlists.push(text);
      loadedSources.push(url);
    } catch (error) {
      lastError = error;
      console.warn("Unable to load IPTV playlist", url, error);
    }
  }

  if (playlists.length > 0) {
    const mergedText = playlists.map((text) => text.replace(/^#EXTM3U[^\n]*\n?/i, "")).join("\n");
    const catalog = parseM3u("#EXTM3U\n" + mergedText, loadedSources.join(" + "));
    if (catalog.channels.length > 0) return catalog;
  }

  console.error("Unable to load IPTV catalog", lastError);
  return {
    channels: [],
    categories: [],
    fetchedAt: new Date().toISOString(),
    source: "unavailable",
  };
}

export async function getCatalog(): Promise<Catalog> {
  if (memory && memory.expiresAt > Date.now()) return memory.catalog;
  if (inflight) return inflight;

  inflight = buildCatalog();
  try {
    const catalog = await inflight;
    memory = { expiresAt: Date.now() + CACHE_MS, catalog };
    return catalog;
  } finally {
    inflight = null;
  }
}

export function toPublicChannel(channel: Channel): PublicChannel {
  return {
    id: channel.id,
    name: channel.name,
    logo: channel.logo,
    category: channel.category,
    country: channel.country,
    sourceCount: channel.sources.length,
    sourceKinds: channel.sources.map((source) => source.kind),
  };
}

export async function getChannel(channelId: string): Promise<Channel | null> {
  const catalog = await getCatalog();
  return catalog.channels.find((channel) => channel.id === channelId) || null;
}

export async function getCategory(slug: string): Promise<{ name: string; channels: Channel[] } | null> {
  const catalog = await getCatalog();
  const category = catalog.categories.find((item) => item.slug === slug);
  if (!category) return null;
  return {
    name: category.name,
    channels: catalog.channels.filter((channel) => categorySlug(channel.category) === slug),
  };
}

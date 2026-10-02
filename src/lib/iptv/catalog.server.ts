import { parseM3u, categorySlug } from "./m3u";
import type { Catalog, Channel, PublicChannel } from "./types";

const DEFAULT_PLAYLIST =
  "https://gist.githubusercontent.com/Syed-Bipul-Rahman/09a05c101a5a1610e7bcd70c9b0e5c07/raw/test-iptv.m3u";
const PINNED_FALLBACK =
  "https://gist.githubusercontent.com/Syed-Bipul-Rahman/09a05c101a5a1610e7bcd70c9b0e5c07/raw/7d95bf13463c313ecdb090ad6d05851e834cce7b/test-iptv.m3u";
const CACHE_MS = 5 * 60_000;

let memory: { expiresAt: number; catalog: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;

async function downloadPlaylist(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain;q=0.9, */*;q=0.5",
      "user-agent": "Live-IPTV/1.0",
    },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Playlist fetch failed with HTTP " + String(response.status));
  const text = await response.text();
  if (!text.includes("#EXTINF")) throw new Error("Playlist response is not M3U data");
  return text;
}

async function buildCatalog(): Promise<Catalog> {
  const primary = process.env.IPTV_PLAYLIST_URL?.trim() || DEFAULT_PLAYLIST;
  const fallback = process.env.IPTV_PLAYLIST_FALLBACK_URL?.trim() || PINNED_FALLBACK;
  const candidates = [...new Set([primary, fallback])];

  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      const text = await downloadPlaylist(url);
      const catalog = parseM3u(text, url);
      if (catalog.channels.length > 0) return catalog;
    } catch (error) {
      lastError = error;
    }
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

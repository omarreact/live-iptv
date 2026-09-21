import type { ChannelPreview } from "../types";

const NEXUS_BASE = "https://dearbulut.github.io/iptv/api/v1";
const TIMEOUT_MS = 4_000;

type NexusChannel = {
  id?: string;
  name?: string;
  country?: string;
  categories?: string[];
  logo?: string | null;
  score?: number | null;
  online?: boolean;
  stream_count?: number;
  best_quality?: string | null;
};

function toPreview(channel: NexusChannel): ChannelPreview | null {
  const id = channel.id?.trim();
  const name = channel.name?.trim();
  if (!id || !name) return null;

  const preview = {
    id,
    shortName: name,
    logo: channel.logo ?? "",
    groups: Array.isArray(channel.categories) ? channel.categories : [],
    country: channel.country?.toUpperCase() ?? null,
    quality: channel.best_quality ?? null,
    geoBlocked: false,
    available: channel.online !== false && (channel.stream_count ?? 0) > 0,
  };

  return preview;
}

async function fetchShard(path: string): Promise<NexusChannel[]> {
  const response = await fetch(`${NEXUS_BASE}/${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`IPTV Nexus ${path} failed: ${response.status}`);
  }

  const data = (await response.json()) as NexusChannel[];
  return Array.isArray(data) ? data : [];
}

function ranked(channels: NexusChannel[], limit: number): ChannelPreview[] {
  return channels
    .filter((channel) => channel.online !== false)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.stream_count ?? 0) - (a.stream_count ?? 0))
    .map(toPreview)
    .filter((channel): channel is ChannelPreview => Boolean(channel))
    .slice(0, limit);
}

export async function getNexusCountryChannels(code: string, limit = 18): Promise<ChannelPreview[]> {
  const key = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(key)) return [];
  return ranked(await fetchShard(`by-country/${key}.json`), limit);
}

export async function getNexusCategoryChannels(
  category: string,
  limit = 18,
  country?: string,
): Promise<ChannelPreview[]> {
  const key = category.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!key) return [];

  const raw = await fetchShard(`by-category/${key}.json`);
  const countryCode = country?.trim().toUpperCase();
  const filtered = countryCode
    ? raw.filter((channel) => channel.country?.toUpperCase() === countryCode)
    : raw;

  return ranked(filtered, limit);
}

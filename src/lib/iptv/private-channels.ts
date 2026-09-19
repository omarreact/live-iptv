import "server-only";

import { makePrivateStreamLocator } from "./private-locator";
import { rankStreams } from "./sort";
import { toChannelPreview, type Channel, type ChannelPreview, type Stream } from "./types";

export type PrivateBridgeSource = {
  id: string;
  bridgeStreamId: string;
  quality?: string | null;
};

export type PrivateChannelConfig = {
  id: string;
  name: string;
  logo: string;
  country: "BD";
  category: string;
  altNames?: string[];
  sources: PrivateBridgeSource[];
};

/**
 * Private Bangladesh channel metadata.
 *
 * Only non-secret metadata and bridge stream IDs live here. The bridge URL,
 * bridge secret, provider origin, signed HLS URLs, and provider tokens stay in
 * server-only environment variables / the private-network bridge.
 */
export const BANGLADESH_PRIVATE_CHANNELS = [
  {
    id: "bdp-tsports",
    name: "T Sports",
    logo: "https://i.imgur.com/2JzlorD.png",
    country: "BD",
    category: "sports",
    altNames: ["T-Sports", "টি স্পোর্টস"],
    sources: [{ id: "primary", bridgeStreamId: "105", quality: "1080p" }],
  },
] satisfies readonly PrivateChannelConfig[];

function bridgeConfigured(): boolean {
  return Boolean(
    process.env.PINFLIX_BD_BRIDGE_URL?.trim() &&
      process.env.PINFLIX_BD_BRIDGE_SECRET?.trim(),
  );
}

function sourceToStream(config: PrivateChannelConfig, source: PrivateBridgeSource): Stream {
  return {
    id: `${config.id}:${source.id}`,
    url: makePrivateStreamLocator(config.id, source.id),
    title: `${config.name} live`,
    feed: source.id,
    quality: source.quality ?? null,
    label: null,
    geoBlocked: false,
    not247: false,
    userAgent: null,
    referrer: null,
  };
}

function configToChannel(config: PrivateChannelConfig): Channel | null {
  if (!bridgeConfigured()) return null;

  const streams = rankStreams(config.sources.map((source) => sourceToStream(config, source)));
  const primary = streams[0];
  if (!primary) return null;

  return {
    id: config.id,
    name: config.name,
    shortName: config.name,
    logo: config.logo,
    url: primary.url,
    groups: [config.category],
    country: "BD",
    quality: primary.quality,
    geoBlocked: false,
    not247: false,
    userAgent: null,
    referrer: null,
    network: null,
    altNames: config.altNames ?? [],
    website: null,
    streams,
    guide: null,
  };
}

export function getBangladeshPrivateChannels(): Channel[] {
  return BANGLADESH_PRIVATE_CHANNELS.map(configToChannel).filter(
    (item): item is Channel => Boolean(item),
  );
}

export function getBangladeshPrivatePreviews(): ChannelPreview[] {
  return getBangladeshPrivateChannels().map(toChannelPreview);
}

export function getPrivateChannelById(id: string): Channel | null {
  return getBangladeshPrivateChannels().find((channel) => channel.id === id) ?? null;
}

export function getPrivateSourceConfig(
  channelId: string,
  sourceId: string,
): { channel: PrivateChannelConfig; source: PrivateBridgeSource } | null {
  const channel = BANGLADESH_PRIVATE_CHANNELS.find((item) => item.id === channelId);
  if (!channel) return null;
  const source = channel.sources.find((item) => item.id === sourceId);
  return source ? { channel, source } : null;
}

export function getPrivateChannelsByCategory(category: string): ChannelPreview[] {
  const key = category.trim().toLowerCase();
  return getBangladeshPrivateChannels()
    .filter((channel) => channel.groups.includes(key))
    .map(toChannelPreview);
}

export function searchPrivateChannels(query: string, limit = 60): ChannelPreview[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return getBangladeshPrivateChannels()
    .map((channel) => {
      const fields = [channel.shortName, channel.name, ...channel.altNames].map((value) =>
        value.toLowerCase(),
      );
      let score = 0;
      if (fields.some((value) => value === q)) score = 100;
      else if (fields.some((value) => value.startsWith(q))) score = 90;
      else if (fields.some((value) => value.includes(q))) score = 60;
      else if (channel.groups.some((group) => group.includes(q))) score = 40;
      else if (q === "bd" || q.includes("bangladesh")) score = 25;
      return { channel, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.channel.shortName.localeCompare(b.channel.shortName))
    .slice(0, limit)
    .map(({ channel }) => toChannelPreview(channel));
}

import type {
  IptvOrgChannel,
  IptvOrgStream,
  AppChannel,
  Channel,
  Stream,
} from "../types";

function isUsableUrl(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) &&
    !/\.mpd(?:\?|#|$)/i.test(url) &&
    !/youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com/i.test(url)
  );
}

function qualityScore(quality: string | null | undefined): number {
  const match = quality?.match(/(\d{3,4})p/i);
  return match ? Number(match[1]) : 0;
}

/**
 * Join iptv-org channels.json + streams.json into AppChannel[].
 * Drops channels with no playable HTTP(S) streams.
 */
export function normalizeChannels(
  channels: IptvOrgChannel[],
  streams: IptvOrgStream[],
): AppChannel[] {
  const streamMap = new Map<string, IptvOrgStream[]>();

  for (const stream of streams) {
    if (!stream.channel || !isUsableUrl(stream.url)) continue;
    const list = streamMap.get(stream.channel) ?? [];
    list.push(stream);
    streamMap.set(stream.channel, list);
  }

  const appChannels: AppChannel[] = [];
  for (const channel of channels) {
    if (channel.is_nsfw) continue;
    const channelStreams = streamMap.get(channel.id) ?? [];
    if (channelStreams.length === 0) continue;
    appChannels.push({ ...channel, streams: channelStreams });
  }
  return appChannels;
}

/** Map a raw iptv-org stream into the UI Stream shape. */
export function toUiStream(raw: IptvOrgStream, channelId: string): Stream {
  const label = raw.label ?? "";
  return {
    id: `${channelId}:${raw.feed ?? "main"}:${raw.url}`,
    url: raw.url,
    title: raw.title || "Live stream",
    feed: raw.feed ?? null,
    quality: raw.quality ?? null,
    label: raw.label ?? null,
    geoBlocked: /geo[- ]?blocked/i.test(label),
    not247: /not\s*24\s*\/\s*7/i.test(label),
    userAgent: raw.user_agent ?? null,
    referrer: raw.referrer ?? null,
  };
}

/** Map AppChannel → existing UI Channel used by cards / player. */
export function toUiChannel(app: AppChannel, logoUrl = ""): Channel {
  const streams = [...app.streams]
    .map((s) => toUiStream(s, app.id))
    .sort((a, b) => {
      const blocked = Number(a.geoBlocked || a.not247) - Number(b.geoBlocked || b.not247);
      return blocked || qualityScore(b.quality) - qualityScore(a.quality);
    });

  const primary = streams[0];
  return {
    id: app.id,
    name: app.name,
    shortName: app.name,
    logo: logoUrl || app.logo || "",
    url: primary?.url ?? "",
    groups: (app.categories ?? []).map((c) => c.trim().toLowerCase()),
    country: app.country?.toUpperCase() ?? null,
    quality: primary?.quality ?? null,
    geoBlocked: primary?.geoBlocked ?? false,
    not247: primary?.not247 ?? false,
    userAgent: primary?.userAgent ?? null,
    referrer: primary?.referrer ?? null,
    network: app.network ?? null,
    altNames: app.alt_names ?? [],
    website: app.website ?? null,
    streams,
  };
}

import "server-only";

import { CATEGORY_META } from "./meta";
import { getIptvCatalog } from "./provider/iptv-org";
import { channelScore, sortChannels } from "./sort";
import { toChannelPreview, type Channel, type ChannelPreview } from "./types";

function primaryGroup(channel: Channel): string | null {
  return channel.groups.find((group) => CATEGORY_META[group]) ?? channel.groups[0] ?? null;
}

function relevanceScore(
  current: Channel,
  candidate: Channel,
  viewerCountry?: string | null,
): number {
  let score = channelScore(candidate);

  const currentCountry = current.country?.toUpperCase() ?? null;
  const candidateCountry = candidate.country?.toUpperCase() ?? null;
  const viewer = viewerCountry?.toUpperCase() ?? null;

  const sameCountry =
    Boolean(currentCountry) && Boolean(candidateCountry) && currentCountry === candidateCountry;

  if (sameCountry) score += 1200;

  const currentPrimary = primaryGroup(current);
  if (currentPrimary && candidate.groups.includes(currentPrimary)) {
    score += 520;
    if (sameCountry) score += 260;
  }

  const currentGroups = new Set(current.groups);
  const sharedGroups = candidate.groups.reduce(
    (count, group) => count + (currentGroups.has(group) ? 1 : 0),
    0,
  );
  score += Math.min(sharedGroups, 2) * 180;

  if (viewer && candidateCountry === viewer) {
    score += 320;
  }

  if (
    current.network &&
    candidate.network &&
    current.network.toLowerCase() === candidate.network.toLowerCase()
  ) {
    score += 100;
  }

  return score;
}

/**
 * Smart "More channels" ranking:
 * 1) same channel country,
 * 2) same category / related category,
 * 3) viewer-local country,
 * 4) stream health / quality from the existing channel score.
 *
 * This intentionally avoids random global suggestions while useful local or
 * relevant channels are available.
 */
export async function getSmartRelatedChannels(
  current: Channel,
  options: {
    viewerCountry?: string | null;
    limit?: number;
    extraChannels?: Channel[];
  } = {},
): Promise<ChannelPreview[]> {
  const catalog = await getIptvCatalog();
  const limit = Math.max(1, options.limit ?? 16);
  const candidates = new Map<string, Channel>();

  const add = (channel: Channel) => {
    if (channel.id === current.id || channel.geoBlocked) return;
    if (!candidates.has(channel.id)) candidates.set(channel.id, channel);
  };

  for (const channel of options.extraChannels ?? []) add(channel);

  if (current.country) {
    for (const channel of catalog.byCountry.get(current.country.toUpperCase()) ?? []) add(channel);
  }

  for (const group of current.groups) {
    for (const channel of catalog.byCategory.get(group) ?? []) add(channel);
  }

  const viewerCountry = options.viewerCountry?.toUpperCase();
  if (viewerCountry) {
    for (const channel of catalog.byCountry.get(viewerCountry) ?? []) add(channel);
  }

  // Rare fallback for channels with little catalog context. It only runs when
  // the local/relevant candidate pool is too small.
  if (candidates.size < limit * 2) {
    for (const channel of sortChannels(catalog.channels, "default").slice(0, 80)) add(channel);
  }

  return [...candidates.values()]
    .map((channel) => ({
      channel,
      score: relevanceScore(current, channel, viewerCountry),
      health: channelScore(channel),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.health - a.health ||
        a.channel.shortName.localeCompare(b.channel.shortName),
    )
    .slice(0, limit)
    .map(({ channel }) => toChannelPreview(channel));
}

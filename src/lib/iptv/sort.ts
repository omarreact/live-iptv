import { PRIMARY_CATEGORY_IDS, type PrimaryCategoryId } from "./meta";
import type { Channel, Stream } from "./types";

/** Supported list sort modes (URL `?sort=`). */
export const SORT_MODES = ["default", "quality", "name", "streams"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export function parseSortMode(raw: string | null | undefined): SortMode {
  const v = raw?.trim().toLowerCase();
  if (v && (SORT_MODES as readonly string[]).includes(v)) return v as SortMode;
  return "default";
}

const PRIMARY_RANK = new Map(
  PRIMARY_CATEGORY_IDS.map((id, i) => [id, i] as const),
);

/** Parse resolution labels like 1080p, 720p, 4K → numeric height. */
export function qualityScore(quality: string | null | undefined): number {
  if (!quality) return 0;
  const q = quality.toLowerCase();
  if (/\b4k\b|uhd|2160/.test(q)) return 2160;
  if (/\b2k\b|1440/.test(q)) return 1440;
  const match = q.match(/(\d{3,4})\s*p/);
  if (match) return Number(match[1]);
  if (/\bfhd\b|full\s*hd/.test(q)) return 1080;
  if (/\bhd\b/.test(q)) return 720;
  if (/\bsd\b/.test(q)) return 480;
  return 0;
}

function restrictionPenalty(s: Pick<Stream, "geoBlocked" | "not247">): number {
  return Number(s.geoBlocked) * 2 + Number(s.not247);
}

/**
 * Dynamic stream ranking for playback fallback order:
 * 1. Prefer unrestricted (not geo / not 24-7-only)
 * 2. Higher resolution
 * 3. Stable id tie-break
 */
export function compareStreams(a: Stream, b: Stream): number {
  const rest = restrictionPenalty(a) - restrictionPenalty(b);
  if (rest !== 0) return rest;
  const q = qualityScore(b.quality) - qualityScore(a.quality);
  if (q !== 0) return q;
  return a.id.localeCompare(b.id);
}

export function rankStreams(streams: Stream[]): Stream[] {
  return [...streams].sort(compareStreams);
}

function bestPrimaryRank(groups: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const g of groups) {
    const r = PRIMARY_RANK.get(g as PrimaryCategoryId);
    if (r !== undefined && r < best) best = r;
  }
  return Number.isFinite(best) ? best : 100;
}

/**
 * Composite channel score used by the default guide sort.
 * Higher is better.
 */
export function channelScore(ch: Channel): number {
  let score = 0;

  // Availability of the primary stream
  if (!ch.geoBlocked) score += 40;
  if (!ch.not247) score += 20;

  // Resolution of best ranked stream
  const q = qualityScore(ch.quality);
  score += Math.min(30, Math.round(q / 72)); // 1080p ≈ 15, 2160p ≈ 30

  // Multiple sources → more resilient player fallback
  const n = ch.streams?.length ?? 0;
  score += Math.min(15, n * 3);

  // Logo present → better card UX
  if (ch.logo) score += 5;

  // Prefer channels tagged with primary shelves
  score += Math.max(0, 12 - bestPrimaryRank(ch.groups));

  return score;
}

function compareByName(a: Channel, b: Channel): number {
  return a.shortName.localeCompare(b.shortName, undefined, { sensitivity: "base" });
}

/**
 * Sort a channel list dynamically by mode.
 * - default: composite score (availability → quality → streams → shelf)
 * - quality: resolution, then availability
 * - name: A–Z
 * - streams: most alternate sources first
 */
export function sortChannels(channels: Channel[], mode: SortMode = "default"): Channel[] {
  const list = [...channels];

  switch (mode) {
    case "name":
      return list.sort(compareByName);

    case "quality":
      return list.sort((a, b) => {
        const q = qualityScore(b.quality) - qualityScore(a.quality);
        if (q !== 0) return q;
        const rest =
          restrictionPenalty(a) - restrictionPenalty(b);
        if (rest !== 0) return rest;
        return compareByName(a, b);
      });

    case "streams":
      return list.sort((a, b) => {
        const n = (b.streams?.length ?? 0) - (a.streams?.length ?? 0);
        if (n !== 0) return n;
        return channelScore(b) - channelScore(a) || compareByName(a, b);
      });

    case "default":
    default:
      return list.sort((a, b) => {
        const s = channelScore(b) - channelScore(a);
        if (s !== 0) return s;
        return compareByName(a, b);
      });
  }
}

/** Sort countries by channel count (desc), then name. */
export function sortCountriesByCount<
  T extends { count: number; name: string; code: string },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.code.localeCompare(b.code),
  );
}

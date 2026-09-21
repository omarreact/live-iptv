import "server-only";

import { getCaptions, getStreamSources } from "@/lib/moviebox/service";
import type { MovieBoxCaption, MovieBoxStreamSource } from "@/lib/moviebox/types";
import type { PlaybackProtocol, PlaybackResult, PlaybackSource } from "@/types/media";
import type { PlaybackProvider, ResolvePlaybackInput } from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readUrl(record: JsonRecord): string | null {
  for (const key of ["url", "playUrl", "play_url", "streamUrl", "stream_url", "file", "src"]) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function detectProtocol(type: unknown, url: string, fallback?: PlaybackProtocol): PlaybackProtocol {
  const declared = asString(type)?.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (declared === "hls" || lowerUrl.includes(".m3u8")) return "hls";
  if (declared === "dash" || lowerUrl.includes(".mpd")) return "dash";
  if (declared === "mp4" || lowerUrl.includes(".mp4")) return "mp4";
  return fallback ?? "mp4";
}

function fromTypedSource(source: MovieBoxStreamSource): PlaybackSource {
  return {
    url: source.url,
    protocol: detectProtocol(source.type, source.url),
    quality: source.quality,
  };
}

function fromRecord(value: unknown, fallback: PlaybackProtocol): PlaybackSource | null {
  const record = asRecord(value);
  if (!record) return null;

  const url = readUrl(record);
  if (!url) return null;

  const quality =
    asString(record.quality) ??
    asString(record.resolution) ??
    asString(record.resolutions) ??
    undefined;

  return {
    url,
    protocol: detectProtocol(record.format ?? record.type, url, fallback),
    quality,
    mimeType: asString(record.mimeType) ?? asString(record.mime_type) ?? undefined,
  };
}

function captionUrl(caption: MovieBoxCaption): string | null {
  return asString(caption.url) ?? asString(caption.file) ?? asString(caption.src);
}

function qualityValue(value?: string): number {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export const legacyEntertainmentProvider: PlaybackProvider = {
  id: "moviebox",

  async resolve(input: ResolvePlaybackInput): Promise<PlaybackResult> {
    if (!input.slug) throw new Error("This provider requires a detail slug");

    const initialSeason = input.season ?? 1;
    const initialEpisode = input.episode ?? 1;
    const stream = await getStreamSources(input.id, input.slug, initialSeason, initialEpisode);

    const usedSeason = stream.se ?? initialSeason;
    const usedEpisode = stream.ep ?? initialEpisode;

    const captions = stream.has_resource
      ? await getCaptions(input.id, input.slug, usedSeason, usedEpisode).catch(() => null)
      : null;

    const candidates: PlaybackSource[] = [
      ...stream.sources.map(fromTypedSource),
      ...(stream.hls ?? [])
        .map((entry) => fromRecord(entry, "hls"))
        .filter((entry): entry is PlaybackSource => entry !== null),
      ...(stream.dash ?? [])
        .map((entry) => fromRecord(entry, "dash"))
        .filter((entry): entry is PlaybackSource => entry !== null),
    ];

    const unique = new Map<string, PlaybackSource>();
    for (const source of candidates) {
      if (!unique.has(source.url)) unique.set(source.url, source);
    }

    const sources = [...unique.values()].sort(
      (left, right) => qualityValue(right.quality) - qualityValue(left.quality),
    );

    const subtitles = (captions?.captions ?? []).flatMap((caption) => {
      const url = captionUrl(caption);
      if (!url) return [];

      const language =
        asString(caption.language) ?? asString(caption.lang) ?? asString(caption.lan) ?? "en";

      return [
        {
          label: asString(caption.label) ?? asString(caption.lanName) ?? language,
          language,
          url,
        },
      ];
    });

    return {
      title: stream.title,
      sources,
      subtitles,
    };
  },
};

import "server-only";

import {
  detectPlaybackProtocol,
  extractPlayInfoHeaders,
  normalizePlaybackQuality,
  resolvePlayInfoUrl,
} from "@/lib/moviebox/play-info.server";
import { getCaptions, getStreamSources } from "@/lib/moviebox/service";
import type {
  MovieBoxCaption,
  MovieBoxStreamSource,
} from "@/lib/moviebox/types";
import type {
  PlaybackProtocol,
  PlaybackResult,
  PlaybackSource,
} from "@/types/media";
import type { PlaybackProvider, ResolvePlaybackInput } from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fromTypedSource(source: MovieBoxStreamSource): PlaybackSource {
  return {
    url: source.url,
    protocol: detectPlaybackProtocol(source.type, source.url),
    quality: normalizePlaybackQuality(source.quality),
    headers: source.headers,
  };
}

function fromRecord(
  value: unknown,
  fallback: PlaybackProtocol,
): PlaybackSource | null {
  const record = asRecord(value);
  if (!record) return null;

  const declared = record.format ?? record.type ?? record.protocol;
  const url = resolvePlayInfoUrl(record, declared);
  if (!url) return null;

  return {
    url,
    protocol: detectPlaybackProtocol(declared, url, fallback),
    quality: normalizePlaybackQuality(
      record.quality ??
        record.resolution ??
        record.resolutions ??
        record.definition,
    ),
    mimeType:
      asString(record.mimeType) ??
      asString(record.mime_type) ??
      undefined,
    headers: extractPlayInfoHeaders(record),
  };
}

function captionUrl(caption: MovieBoxCaption): string | null {
  return (
    asString(caption.url) ??
    asString(caption.file) ??
    asString(caption.src)
  );
}

function normalizeSubtitleLanguage(value: string): string {
  const normalized = value.trim().replace(/_/g, "-");
  if (normalized.toLowerCase() === "in-id") return "id";
  return normalized || "en";
}

function qualityValue(value?: string): number {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export const legacyEntertainmentProvider: PlaybackProvider = {
  id: "moviebox",

  async resolve(input: ResolvePlaybackInput): Promise<PlaybackResult> {
    if (!input.slug) {
      throw new Error("This provider requires a detail slug");
    }

    const initialSeason = input.season ?? 1;
    const initialEpisode = input.episode ?? 1;
    const stream = await getStreamSources(
      input.id,
      input.slug,
      initialSeason,
      initialEpisode,
    );

    const usedSeason = stream.se ?? initialSeason;
    const usedEpisode = stream.ep ?? initialEpisode;

    const captions = stream.has_resource
      ? await getCaptions(
          input.id,
          input.slug,
          usedSeason,
          usedEpisode,
        ).catch(() => null)
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
      const key = [
        source.protocol,
        source.quality ?? "",
        source.url,
      ].join("|");

      if (!unique.has(key)) {
        unique.set(key, source);
      }
    }

    const sources = [...unique.values()].sort(
      (left, right) =>
        qualityValue(right.quality) - qualityValue(left.quality),
    );

    const subtitles = (captions?.captions ?? []).flatMap((caption) => {
      const url = captionUrl(caption);
      if (!url) return [];

      const language = normalizeSubtitleLanguage(
        asString(caption.language) ??
          asString(caption.lang) ??
          asString(caption.lan) ??
          "en",
      );

      return [
        {
          label:
            asString(caption.label) ??
            asString(caption.lanName) ??
            language,
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

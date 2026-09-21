import "server-only";

import type { PlaybackProtocol, PlaybackResult, PlaybackSource } from "@/types/media";
import type { PlaybackProvider, ResolvePlaybackInput } from "./types";

type RawSource = {
  url?: unknown;
  format?: unknown;
  protocol?: unknown;
  quality?: unknown;
  mimeType?: unknown;
  headers?: unknown;
};

type RawSubtitle = {
  label?: unknown;
  language?: unknown;
  url?: unknown;
};

type RawResponse = {
  title?: unknown;
  sources?: unknown;
  subtitles?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const headers = Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

  return Object.keys(headers).length ? headers : undefined;
}

function detectProtocol(source: RawSource, url: string): PlaybackProtocol {
  const declared = asString(source.protocol)?.toLowerCase();
  const format = asString(source.format)?.toLowerCase();
  const mimeType = asString(source.mimeType)?.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (
    declared === "hls" ||
    format === "hls" ||
    lowerUrl.includes(".m3u8") ||
    mimeType?.includes("mpegurl")
  ) {
    return "hls";
  }

  if (
    declared === "dash" ||
    format === "dash" ||
    lowerUrl.includes(".mpd") ||
    mimeType?.includes("dash+xml")
  ) {
    return "dash";
  }

  return "mp4";
}

function normalizeSource(value: unknown): PlaybackSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as RawSource;
  const url = asString(source.url);
  if (!url) return null;

  return {
    url,
    protocol: detectProtocol(source, url),
    quality: asString(source.quality),
    mimeType: asString(source.mimeType),
    headers: asHeaders(source.headers),
  };
}

export const authorizedProvider: PlaybackProvider = {
  id: "authorized",

  async resolve(input: ResolvePlaybackInput): Promise<PlaybackResult> {
    const apiBase = process.env.AUTHORIZED_MEDIA_API_BASE;
    const apiKey = process.env.AUTHORIZED_MEDIA_API_KEY;

    if (!apiBase) {
      throw new Error("AUTHORIZED_MEDIA_API_BASE is not configured");
    }

    const url = new URL(`/playback/${encodeURIComponent(input.id)}`, apiBase);
    if (input.slug) url.searchParams.set("slug", input.slug);
    if (input.season !== undefined) url.searchParams.set("season", String(input.season));
    if (input.episode !== undefined) url.searchParams.set("episode", String(input.episode));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Authorized provider returned ${response.status}`);
    }

    const payload = (await response.json()) as RawResponse;
    const sources = Array.isArray(payload.sources)
      ? payload.sources
          .map(normalizeSource)
          .filter((source): source is PlaybackSource => source !== null)
      : [];

    const subtitles = Array.isArray(payload.subtitles)
      ? payload.subtitles.flatMap((value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return [];
          const subtitle = value as RawSubtitle;
          const subtitleUrl = asString(subtitle.url);
          if (!subtitleUrl) return [];

          const language = asString(subtitle.language) ?? "en";
          return [
            {
              label: asString(subtitle.label) ?? language,
              language,
              url: subtitleUrl,
            },
          ];
        })
      : [];

    return {
      title: asString(payload.title),
      sources,
      subtitles,
    };
  },
};

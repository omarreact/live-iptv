import "server-only";

import type { ResolvePlaybackInput } from "@/lib/providers/types";
import type { PlaybackSource } from "@/types/media";

type BridgeSource = {
  url?: unknown;
  protocol?: unknown;
  quality?: unknown;
  mimeType?: unknown;
};

type BridgeResponse = {
  sources?: unknown;
};

function configured(): { base: URL; secret: string } | null {
  if (
    !/^(?:1|true|yes)$/i.test(
      process.env.PINFLIX_MOVIEBOX_BRIDGE_ENABLED?.trim() || "",
    )
  ) {
    return null;
  }

  const rawBase = process.env.PINFLIX_BD_BRIDGE_URL?.trim();
  const secret = process.env.PINFLIX_BD_BRIDGE_SECRET?.trim();
  if (!rawBase || !secret) return null;

  const base = new URL(rawBase);
  if (base.protocol !== "https:" && base.hostname !== "localhost") {
    throw new Error("MovieBox bridge must use HTTPS");
  }

  return { base, secret };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function normalizeSource(value: unknown): PlaybackSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as BridgeSource;
  const url = asString(raw.url);
  if (!url) return null;

  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    return null;
  }

  return {
    url: parsed.href,
    protocol: "mp4",
    quality: asString(raw.quality),
    mimeType: asString(raw.mimeType) ?? "video/mp4",
  };
}

export async function resolveMovieBoxBridge(
  input: ResolvePlaybackInput,
): Promise<PlaybackSource[] | null> {
  const config = configured();
  if (!config || !input.slug) return null;

  const url = new URL("/v1/moviebox/resolve", config.base);
  url.searchParams.set("id", input.id);
  url.searchParams.set("slug", input.slug);
  url.searchParams.set("season", String(input.season ?? 1));
  url.searchParams.set("episode", String(input.episode ?? 1));

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.secret}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn("[moviebox.bridge] resolve unavailable", {
        status: response.status,
      });
      return null;
    }

    const payload = (await response.json()) as BridgeResponse;
    if (!Array.isArray(payload.sources)) return null;

    const sources = payload.sources
      .map(normalizeSource)
      .filter((source): source is PlaybackSource => source !== null);

    return sources.length ? sources : null;
  } catch (error: unknown) {
    console.warn("[moviebox.bridge] resolve failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

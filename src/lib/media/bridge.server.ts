import "server-only";

import type { MediaBrowsePayload, MediaResolvePayload, MediaSourceSummary } from "./types";

function bridgeConfig(): { base: URL; secret: string } {
  const rawBase = process.env.PINFLIX_BD_BRIDGE_URL?.trim();
  const secret = process.env.PINFLIX_BD_BRIDGE_SECRET?.trim();
  if (!rawBase || !secret) throw new Error("Pinflix media bridge is not configured");

  const base = new URL(rawBase);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("Invalid Pinflix media bridge URL");
  }
  return { base, secret };
}

function safeSourceId(value: string): string {
  const source = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/i.test(source)) throw new Error("Invalid media source");
  return source;
}

function safePath(value: string): string {
  const path = value.trim();
  if (path.length > 4_000 || /[\u0000-\u001f]/.test(path)) throw new Error("Invalid media path");
  return path;
}

async function bridgeJson<T>(pathname: string, params?: URLSearchParams): Promise<T> {
  const { base, secret } = bridgeConfig();
  const url = new URL(pathname, base);
  if (params) url.search = params.toString();

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secret}`,
      "x-pinflix-app": "1",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Media bridge request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getMediaSources(): Promise<MediaSourceSummary[]> {
  const payload = await bridgeJson<{ sources?: MediaSourceSummary[] }>("/v1/media/sources");
  return Array.isArray(payload.sources) ? payload.sources : [];
}

export async function browseMediaSource(source: string, path = ""): Promise<MediaBrowsePayload> {
  const params = new URLSearchParams({ source: safeSourceId(source), path: safePath(path) });
  return bridgeJson<MediaBrowsePayload>("/v1/media/browse", params);
}

export async function resolveMediaSource(source: string, path: string): Promise<MediaResolvePayload> {
  const { base } = bridgeConfig();
  const params = new URLSearchParams({ source: safeSourceId(source), path: safePath(path) });
  const payload = await bridgeJson<MediaResolvePayload>("/v1/media/resolve", params);

  for (const candidate of [payload.url, payload.transcodeUrl]) {
    const resolved = new URL(candidate);
    if (resolved.origin !== base.origin) throw new Error("Media bridge returned an unexpected origin");
  }
  return payload;
}

import "server-only";

import type { PlaybackProtocol } from "@/types/media";

type JsonRecord = Record<string, unknown>;

const DUMMY_INDICATORS = [
  "b164fbfb43477929",
  "please update",
  "update your app",
  "/other/",
  "macdn.aoneroom.com/other",
  "dummy",
  "placeholder",
] as const;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isDummyUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return DUMMY_INDICATORS.some((indicator) => lower.includes(indicator));
}

function readCookie(record: JsonRecord): string | null {
  for (const key of ["signCookie", "sign_cookie", "cookie", "sign"]) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function readUrlPrefix(record: JsonRecord, cookie: string): string | null {
  const explicit =
    asString(record.urlPrefix) ?? asString(record.url_prefix) ?? asString(record.urlprefix);
  const match = cookie.match(/(?:^|[;,\s])urlprefix\s*=\s*([^;,\s]+)/i);
  const raw = explicit ?? match?.[1];
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const encoded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);

  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8").trim();
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function manifestExtension(declared: unknown, base: string): ".m3u8" | ".mpd" {
  const value = asString(declared)?.toLowerCase() ?? "";
  const lowerBase = base.toLowerCase();

  if (
    value.includes("hls") ||
    value.includes("m3u8") ||
    lowerBase.includes("hls") ||
    lowerBase.includes("m3u8")
  ) {
    return ".m3u8";
  }

  return ".mpd";
}

function buildManifestUrl(base: string, declared?: unknown): string {
  try {
    const parsed = new URL(base);
    const pathname = parsed.pathname.toLowerCase();

    if (pathname.endsWith(".mpd") || pathname.endsWith(".m3u8")) {
      return parsed.toString();
    }

    const extension = manifestExtension(declared, base);
    parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/index${extension}`;
    return parsed.toString();
  } catch {
    const [path, query = ""] = base.split("?", 2);
    if (/\.(?:mpd|m3u8)$/i.test(path)) return base;

    const extension = manifestExtension(declared, base);
    const next = `${path.replace(/\/$/, "")}/index${extension}`;
    return query ? `${next}?${query}` : next;
  }
}

export function detectPlaybackProtocol(
  declared: unknown,
  url: string,
  fallback: PlaybackProtocol = "mp4",
): PlaybackProtocol {
  const value = asString(declared)?.toLowerCase() ?? "";
  const lowerUrl = url.toLowerCase();

  if (value.includes("hls") || value.includes("m3u8") || lowerUrl.includes(".m3u8")) {
    return "hls";
  }

  if (value.includes("dash") || value.includes("mpd") || lowerUrl.includes(".mpd")) {
    return "dash";
  }

  if (value.includes("mp4") || lowerUrl.includes(".mp4")) {
    return "mp4";
  }

  return fallback;
}

export function normalizePlaybackQuality(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  const match = raw.match(/(2160|1440|1080|720|480|360|240)/);
  if (match?.[1]) return `${match[1]}P`;

  return raw.toUpperCase();
}

export function resolvePlayInfoUrl(value: unknown, declaredFormat?: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;

  for (const key of ["url", "playUrl", "play_url", "streamUrl", "stream_url", "file", "src"]) {
    const url = asString(record[key]);
    if (url && !isDummyUrl(url)) return url;
  }

  const cookie = readCookie(record) ?? "";
  const base = readUrlPrefix(record, cookie);
  return base ? buildManifestUrl(base, declaredFormat ?? record.format ?? record.type) : null;
}

export function extractPlayInfoHeaders(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const output: Record<string, string> = {};
  const explicit = asRecord(record.headers);

  for (const [name, headerValue] of Object.entries(explicit ?? {})) {
    if (typeof headerValue === "string" && headerValue.trim()) {
      output[name] = headerValue;
    }
  }

  const cookie = readCookie(record);
  if (cookie && !output.Cookie && !output.cookie) {
    output.Cookie = cookie;
  }

  return Object.keys(output).length ? output : undefined;
}

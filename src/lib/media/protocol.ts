import type { PlaybackProtocol } from "@/types/media";

type ProtocolInput = {
  url: string;
  protocol?: string;
  mimeType?: string;
};

const HLS_MIME_TYPES = [
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
];

const DASH_MIME_TYPES = ["application/dash+xml"];

export function detectPlaybackProtocol(source: ProtocolInput): PlaybackProtocol {
  const declared = source.protocol?.trim().toLowerCase();
  if (declared === "hls" || declared === "dash" || declared === "mp4") {
    return declared;
  }

  const mimeType = source.mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (HLS_MIME_TYPES.includes(mimeType)) return "hls";
  if (DASH_MIME_TYPES.includes(mimeType)) return "dash";
  if (mimeType.startsWith("video/")) return "mp4";

  const raw = source.url.trim();
  const lower = raw.toLowerCase();

  try {
    const parsed = new URL(raw, "https://pinflix.invalid");
    const pathname = parsed.pathname.toLowerCase();
    const hint = [
      parsed.searchParams.get("format"),
      parsed.searchParams.get("type"),
      parsed.searchParams.get("protocol"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (pathname.endsWith(".m3u8") || hint.includes("hls") || hint.includes("m3u8")) {
      return "hls";
    }

    if (pathname.endsWith(".mpd") || hint.includes("dash") || hint.includes("mpd")) {
      return "dash";
    }

    if (
      pathname.endsWith(".mp4") ||
      pathname.endsWith(".m4v") ||
      pathname.endsWith(".webm") ||
      pathname.endsWith(".mov")
    ) {
      return "mp4";
    }
  } catch {
    // Fall back to string heuristics below.
  }

  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".mpd")) return "dash";

  return "mp4";
}

export function qualityHeight(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/(\d{3,4})\s*p?/i);
  if (!match) return null;

  const height = Number(match[1]);
  return Number.isFinite(height) && height > 0 ? height : null;
}

export function closestQualityIndex(
  heights: Array<number | null | undefined>,
  preferredHeight: number,
): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  heights.forEach((height, index) => {
    if (!height) return;
    const distance = Math.abs(height - preferredHeight);

    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return bestIndex;
}

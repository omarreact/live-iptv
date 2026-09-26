import "server-only";

import type { PlaybackProvider, ResolvePlaybackInput } from "./types";
import type { PlaybackProtocol, PlaybackResult } from "@/types/media";

const BASE = "http://cineplexbd.net";
const EDGE = process.env.CINEPLEX_MEDIA_EDGE_BASE?.trim() || "https://media.pincodeit.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";

async function fetchHtml(url: URL): Promise<string> {
  const run = (target: string) =>
    fetch(target, {
      headers: {
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "user-agent": UA,
        referer: BASE + "/",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

  let response = await run(url.href).catch(() => null);

  if (!response?.ok) {
    const edge = new URL("/proxy", EDGE);
    edge.searchParams.set("url", url.href);
    response = await run(edge.href);
  }

  if (!response.ok) {
    throw new Error(`CineplexBD player returned ${response.status}`);
  }

  return response.text();
}

function extractVideoUrl(html: string): string | null {
  const candidates = [
    html.match(/const\s+videoSrc\s*=\s*["']([^"']+)["']/i)?.[1],
    html.match(/<source\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*type\s*=\s*["']video\/mp4["']/i)?.[1],
    html.match(/<source\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*type\s*=\s*["']application\/x-mpegURL["']/i)?.[1],
    html.match(/<source\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1],
    html.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i)?.[1],
  ];

  for (const candidate of candidates) {
    if (candidate?.trim()) return candidate.trim();
  }
  return null;
}

function transformVodUrl(raw: string): string {
  if (/^http:\/\/vod\.cineplexbd\.net:8081\//i.test(raw)) {
    let path = raw.replace(/^http:\/\/vod\.cineplexbd\.net:8081\//i, "/hls/");
    path = path.replace(/^\/hls\/tv-series\//i, "/hls/t/");
    path = path.replace(/^\/hls\/movies\//i, "/hls/m/");
    path = path.replace(/\/index\.m3u8(?:\?.*)?$/i, "/master.m3u8");
    return new URL(path, BASE).href;
  }
  return new URL(raw, BASE).href;
}

function protocolFor(url: string): PlaybackProtocol {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".mpd")) return "dash";
  return "mp4";
}

function safeId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new Error("Invalid CineplexBD id");
  }
  return value;
}

export const cineplexProvider: PlaybackProvider = {
  id: "cineplex",

  async resolve(input: ResolvePlaybackInput): Promise<PlaybackResult> {
    const id = safeId(input.id);
    const kind = input.slug === "series" ? "series" : "movie";

    const player =
      kind === "series"
        ? new URL("/watch.php", BASE)
        : new URL("/player.php", BASE);

    if (kind === "series") {
      player.searchParams.set("series_id", id);
      player.searchParams.set("season", String(input.season ?? 1));
      player.searchParams.set("ep", String(input.episode ?? 1));
    } else {
      player.searchParams.set("id", id);
    }

    const html = await fetchHtml(player);
    const raw = extractVideoUrl(html);
    if (!raw) {
      return {
        title: kind === "series" ? `CineplexBD Series ${id}` : `CineplexBD Movie ${id}`,
        sources: [],
        subtitles: [],
      };
    }

    const directSource = new URL(raw, BASE).href;
    const transformedSource = transformVodUrl(raw);
    const sourceUrls =
      transformedSource === directSource
        ? [directSource]
        : [directSource, transformedSource];

    return {
      title: kind === "series" ? `CineplexBD Series ${id}` : `CineplexBD Movie ${id}`,
      sources: sourceUrls.map((source, index) => {
        const protocol = protocolFor(source);

        return {
          url: source,
          protocol,
          quality:
            index === 0
              ? protocol === "hls"
                ? "Direct network"
                : "Direct"
              : "Cineplex mirror",
          mimeType:
            protocol === "hls"
              ? "application/vnd.apple.mpegurl"
              : protocol === "dash"
                ? "application/dash+xml"
                : "video/mp4",
        };
      }),
      subtitles: [],
    };
  },
};

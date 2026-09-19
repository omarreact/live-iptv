import { parsePrivateStreamLocator } from "./private-locator";
import type { Channel } from "./types";

export function proxiedStreamUrl(channel: Channel): string {
  const privateSource = parsePrivateStreamLocator(channel.url);
  if (privateSource) {
    const p = new URLSearchParams({ pc: privateSource.channelId, ps: privateSource.sourceId });
    return `/api/stream?${p.toString()}`;
  }

  const p = new URLSearchParams({ u: channel.url });
  if (channel.userAgent) p.set("ua", channel.userAgent);
  if (channel.referrer) p.set("r", channel.referrer);
  return `/api/stream?${p.toString()}`;
}

export function streamKind(url: string): "hls" | "mp4" | "ts" {
  const u = url.toLowerCase();
  if (u.includes(".m3u8") || u.includes(".m3u") || u.includes(".smil")) return "hls";
  if (u.includes(".mp4") || u.includes(".webm") || u.includes(".ogg")) return "mp4";
  return "ts";
}

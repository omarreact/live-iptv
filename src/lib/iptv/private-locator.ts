export const BD_PRIVATE_CHANNEL_PREFIX = "bdp-";
const PRIVATE_SCHEME = "pinflix-private:";

export function isPrivateChannelId(id: string): boolean {
  return id.toLowerCase().startsWith(BD_PRIVATE_CHANNEL_PREFIX);
}

export function makePrivateStreamLocator(channelId: string, sourceId: string): string {
  return `${PRIVATE_SCHEME}//stream/${encodeURIComponent(channelId)}/${encodeURIComponent(sourceId)}.m3u8`;
}

export function parsePrivateStreamLocator(
  raw: string,
): { channelId: string; sourceId: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== PRIVATE_SCHEME || url.hostname !== "stream") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    const channelId = decodeURIComponent(parts[0] ?? "");
    const sourceFile = decodeURIComponent(parts[1] ?? "");
    if (!sourceFile.toLowerCase().endsWith(".m3u8")) return null;
    const sourceId = sourceFile.slice(0, -5);
    if (!channelId || !sourceId) return null;
    return { channelId, sourceId };
  } catch {
    return null;
  }
}

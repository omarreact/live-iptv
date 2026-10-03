import type { Catalog, Channel, SourceKind, StreamSource } from "./types";

const MAX_SOURCES_PER_CHANNEL = 8;

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function sourceKind(url: URL): SourceKind {
  const text = (url.pathname + url.search).toLowerCase();
  if (/\.m3u8?(?:$|[?#])/.test(text) || text.includes("playlist")) return "hls";
  if (/\.(?:mp4|webm|ogg)(?:$|[?#])/.test(text)) return "mp4";
  return "ts";
}

function sourceScore(url: URL): number {
  let score = 50;
  if (url.protocol === "https:") score += 25;
  else score -= 5;
  if (!isIpv4(url.hostname)) score += 10;
  else score -= 12;
  if (sourceKind(url) === "hls") score += 12;
  if (url.port === "80" || url.port === "1935") score -= 4;
  return score;
}

function parseAttrs(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z0-9_-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) attrs[match[1].toLowerCase()] = match[2].trim();
  return attrs;
}

function cleanName(value: string): string {
  return value
    .replace(/\[(?:BD|IN|UK|US|PK|NP|LK|INT)\]/gi, " ")
    .replace(/\(\s*\d+\s*\)\s*$/g, " ")
    .replace(/\b(?:FULL\s*HD|FHD|UHD|4K|HD|SD)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCountry(original: string, metadata = ""): string | null {
  const metadataCountry = metadata
    .split(/[;,]/)
    .map((value) => value.trim().toUpperCase())
    .find((value) => /^[A-Z]{2,3}$/.test(value));
  if (metadataCountry) return metadataCountry;

  const match = original.match(/\[([A-Z]{2,3})\]/i);
  return match ? match[1].toUpperCase() : null;
}

function normalizeCategory(group: string, name: string): string {
  const text = (group + " " + name).toLowerCase();
  if (text.includes("bangla") || text.includes("bengali")) return "Bangla";
  if (text.includes("news")) return "News";
  if (text.includes("sport")) return "Sports";
  if (text.includes("movie") || text.includes("cinema")) return "Entertainment";
  if (text.includes("hindi")) return "Hindi";
  if (text.includes("kid") || text.includes("cartoon")) return "Kids";
  if (text.includes("music")) return "Music";
  if (text.includes("relig") || text.includes("islam") || text.includes("quran")) return "Religious";
  if (text.includes("document")) return "Documentary";
  if (text.includes("english") || text.includes("international")) return "International";
  const cleaned = group.replace(/[^A-Za-z0-9 &-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Other";
  return cleaned.slice(0, 28);
}

function slugBase(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "channel";
}

function hash32(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function categorySlug(value: string): string {
  return slugBase(value);
}

export function parseM3u(text: string, source: string): Catalog {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const merged = new Map<string, Channel>();
  let pending: { name: string; group: string; logo: string; country: string | null } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const attrs = parseAttrs(line);
      const comma = line.indexOf(",");
      const originalName = (comma >= 0 ? line.slice(comma + 1) : attrs["tvg-name"] || "Channel").trim();
      const name = cleanName(originalName) || originalName.slice(0, 100);
      const logoUrl = safeUrl(attrs["tvg-logo"] || "");
      pending = {
        name: name.slice(0, 100),
        group: attrs["group-title"] || "",
        logo: logoUrl?.protocol === "https:" ? logoUrl.href.slice(0, 1000) : "",
        country: inferCountry(originalName, attrs["tvg-country"] || attrs["country"] || ""),
      };
      continue;
    }

    if (line.startsWith("#") || !pending) continue;
    const url = safeUrl(line);
    if (!url) {
      pending = null;
      continue;
    }

    const normalizedName = pending.name.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, " ").trim();
    const key = normalizedName || pending.name.toLowerCase();
    const category = normalizeCategory(pending.group, pending.name);
    const stream: StreamSource = {
      url: url.href,
      kind: sourceKind(url),
      host: url.hostname,
      score: sourceScore(url),
    };

    const existing = merged.get(key);
    if (existing) {
      if (!existing.sources.some((item) => item.url === stream.url) && existing.sources.length < MAX_SOURCES_PER_CHANNEL) {
        existing.sources.push(stream);
        existing.sources.sort((a, b) => b.score - a.score);
      }
      if (!existing.logo && pending.logo) existing.logo = pending.logo;
      if (!existing.country && pending.country) existing.country = pending.country;
      if (existing.category === "Other" && category !== "Other") existing.category = category;
    } else {
      merged.set(key, {
        id: slugBase(pending.name) + "-" + hash32(key),
        name: pending.name,
        normalizedName: key,
        logo: pending.logo,
        category,
        country: pending.country,
        sources: [stream],
      });
    }
    pending = null;
  }

  const channels = [...merged.values()]
    .filter((channel) => channel.sources.length > 0)
    .sort((a, b) => {
      const categoryBias = (a.category === "Bangla" ? -1 : 0) - (b.category === "Bangla" ? -1 : 0);
      return categoryBias || a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });

  const countByCategory = new Map<string, number>();
  for (const channel of channels) {
    countByCategory.set(channel.category, (countByCategory.get(channel.category) || 0) + 1);
  }

  const categories = [...countByCategory.entries()]
    .map(([name, count]) => ({ name, slug: categorySlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    channels,
    categories,
    fetchedAt: new Date().toISOString(),
    source,
  };
}

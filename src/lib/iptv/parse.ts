import type { Channel } from "./types";

const NSFW = new Set(["xxx", "adult", "porn"]);

export function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z0-9-]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

function splitExtinf(line: string): { attrs: string; name: string } {
  const rest = line.replace(/^#EXTINF:-?\d+\s*/, "");
  let inQuote = false;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === "," && !inQuote) {
      return { attrs: rest.slice(0, i), name: rest.slice(i + 1).trim() };
    }
  }
  return { attrs: "", name: rest.trim() };
}

function countryFromTvgId(tvgId: string): string | null {
  const m = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function cleanName(name: string): {
  shortName: string;
  quality: string | null;
  geoBlocked: boolean;
  not247: boolean;
} {
  const geoBlocked = /\[geo-blocked\]/i.test(name);
  const not247 = /\[not 24\/7\]/i.test(name);
  const q = name.match(/\((\d{3,4}p)\)/i);
  const shortName = name
    .replace(/\((\d{3,4}p)\)/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { shortName, quality: q ? q[1].toLowerCase() : null, geoBlocked, not247 };
}

function isPlayableUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url)) return false;
  if (/youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com/i.test(url)) return false;
  if (/\.mpd(\?|#|$)/i.test(url)) return false;
  return true;
}

export function parseM3u(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  let pending: {
    name: string;
    attrs: Record<string, string>;
    userAgent: string | null;
    referrer: string | null;
  } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const { attrs, name } = splitExtinf(line);
      const parsed = parseAttrs(attrs);
      pending = {
        name,
        attrs: parsed,
        userAgent: parsed["http-user-agent"] ?? null,
        referrer: parsed["http-referrer"] ?? parsed["referrer"] ?? null,
      };
      continue;
    }

    if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      if (pending) pending.userAgent = line.slice("#EXTVLCOPT:http-user-agent=".length);
      continue;
    }

    if (line.startsWith("#EXTVLCOPT:http-referrer=")) {
      if (pending) pending.referrer = line.slice("#EXTVLCOPT:http-referrer=".length);
      continue;
    }

    if (line.startsWith("#")) continue;
    if (!pending) continue;

    const url = line;
    const groups = (pending.attrs["group-title"] ?? "")
      .split(";")
      .map((g) => g.trim())
      .filter(Boolean);
    const nsfw = groups.some((g) => NSFW.has(g.toLowerCase()));
    if (!nsfw && isPlayableUrl(url)) {
      const { shortName, quality, geoBlocked, not247 } = cleanName(pending.name);
      const tvgId = pending.attrs["tvg-id"] ?? "";
      channels.push({
        id: hashId(url),
        name: pending.name,
        shortName: shortName || pending.name,
        logo: pending.attrs["tvg-logo"] ?? "",
        url,
        groups,
        country: countryFromTvgId(tvgId),
        quality,
        geoBlocked,
        not247,
        userAgent: pending.userAgent,
        referrer: pending.referrer,
      });
    }
    pending = null;
  }

  return channels;
}

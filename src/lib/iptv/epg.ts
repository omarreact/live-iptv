import type { GuideSource } from "./types";

export type EpgProgram = {
  title: string;
  start: string;
  end: string;
};

export type NowNext = {
  now: EpgProgram | null;
  next: EpgProgram | null;
};

const XML_TIMEOUT_MS = 12_000;
const XML_CACHE_MS = 5 * 60_000;
const MAX_XML_BYTES = 15 * 1024 * 1024;
const xmlCache = new Map<string, { expiresAt: number; xml: string }>();

function readAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function parseXmltvDate(raw: string | null): Date | null {
  if (!raw) return null;
  const match = raw.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-])(\d{2})(\d{2})/,
  );
  if (!match) return null;

  const [, y, mo, d, h, mi, s = "00", sign, oh, om] = match;
  const localUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  const offset = (Number(oh) * 60 + Number(om)) * 60_000 * (sign === "+" ? 1 : -1);
  return new Date(localUtc - offset);
}

async function fetchGuideXml(url: string): Promise<string> {
  const cached = xmlCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.xml;

  const res = await fetch(url, {
    headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
    signal: AbortSignal.timeout(XML_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`EPG source unavailable (${res.status})`);

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_XML_BYTES) throw new Error("EPG source is too large");

  const xml = await res.text();
  if (xml.length > MAX_XML_BYTES) throw new Error("EPG source is too large");
  xmlCache.set(url, { expiresAt: Date.now() + XML_CACHE_MS, xml });
  return xml;
}

export async function getNowNext(guide: GuideSource, at = new Date()): Promise<NowNext> {
  const xml = await fetchGuideXml(guide.url);
  const targetMs = at.getTime();
  const programs: Array<EpgProgram & { startMs: number; endMs: number }> = [];
  const programmeRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;

  for (const match of xml.matchAll(programmeRe)) {
    const attrs = match[1] ?? "";
    const programmeChannel = readAttr(attrs, "channel");
    if (programmeChannel !== guide.xmltvId && programmeChannel !== guide.siteId) continue;

    const start = parseXmltvDate(readAttr(attrs, "start"));
    const end = parseXmltvDate(readAttr(attrs, "stop"));
    if (!start || !end) continue;

    const titleMatch = (match[2] ?? "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const title = decodeXml(titleMatch?.[1] ?? "");
    if (!title) continue;

    programs.push({
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      startMs: start.getTime(),
      endMs: end.getTime(),
    });
  }

  programs.sort((a, b) => a.startMs - b.startMs);
  const nowIndex = programs.findIndex((p) => p.startMs <= targetMs && p.endMs > targetMs);
  const futureIndex = programs.findIndex((p) => p.startMs > targetMs);
  const now = nowIndex >= 0 ? programs[nowIndex] : null;
  const next =
    nowIndex >= 0
      ? programs[nowIndex + 1] ?? null
      : futureIndex >= 0
        ? programs[futureIndex]
        : null;

  return {
    now: now ? { title: now.title, start: now.start, end: now.end } : null,
    next: next ? { title: next.title, start: next.start, end: next.end } : null,
  };
}

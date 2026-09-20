import "server-only";

import type {
  MovieBoxCatalogItem,
  MovieBoxCatalogPayload,
  MovieBoxCatalogRow,
  MovieBoxDetailPayload,
  MovieBoxKind,
} from "./types";

const ORIGIN = "https://themoviebox.xyz";
const HOME = ORIGIN + "/";
const ALLOWED_SECTIONS = [
  "Trending Drama",
  "Trending Movies",
  "Recently Added",
  "Free Now",
  "Into Animeverse",
  "K-Drama: New Release",
  "Trending India",
  "Trending C-Drama",
  "Trending Malay Dramas",
  "Popular BL Series",
  "Trending Malay Movies",
  "Trending Indonesian Movies",
  "Thai-Drama",
  "Western TV",
  "Chasing the Hollywood Dream",
  "Asian Variety Shows",
  "Animated Flim",
  "Animated Film",
  "Midnight Horror",
  "Girls' Love",
  "100% LOVE",
  "Monster & Titan",
];

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function safeAbsolute(raw: string): string | null {
  try {
    const url = new URL(decodeHtml(raw), ORIGIN);
    if (url.origin !== ORIGIN) return null;
    return url.href;
  } catch {
    return null;
  }
}

function cleanSection(raw: string): string | null {
  const text = stripHtml(raw)
    .replace(/[🔥🎬🎉🌟💀💗⚡]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const match = ALLOWED_SECTIONS.find(
    (section) =>
      section.toLowerCase() === text.toLowerCase() ||
      text.toLowerCase().includes(section.toLowerCase()),
  );
  return match ?? null;
}

function sectionKind(section: string): MovieBoxKind {
  const lower = section.toLowerCase();
  if (
    lower.includes("drama") ||
    lower.includes("series") ||
    lower.includes("western tv") ||
    lower.includes("animeverse") ||
    lower.includes("variety")
  ) {
    return "series";
  }
  if (
    lower.includes("movie") ||
    lower.includes("hollywood") ||
    lower.includes("horror") ||
    lower.includes("monster") ||
    lower.includes("animated")
  ) {
    return "movie";
  }
  return "mixed";
}

function imageFromAnchor(inner: string): string | null {
  const match =
    inner.match(/<img\b[^>]*(?:data-src|data-original|src)\s*=\s*["']([^"']+)["']/i) ??
    inner.match(/background-image\s*:\s*url\((?:["']?)([^)"']+)/i);
  if (!match?.[1]) return null;

  try {
    const url = new URL(decodeHtml(match[1]), ORIGIN);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function titleFromAnchor(inner: string, href: string): string {
  const preferred =
    inner.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1] ??
    inner.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ??
    stripHtml(inner);

  const decoded = decodeHtml(preferred || "");
  if (decoded && decoded.length <= 180) return decoded;

  const slug = href.split("/detail/")[1] ?? "";
  const parts = slug.split("-");
  if (parts.length > 1) parts.pop();
  return decodeURIComponent(parts.join(" ").replace(/-/g, " ")) || "Untitled";
}

function idFromHref(href: string): string {
  const raw = href.split("/detail/")[1] ?? href;
  return raw.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function parseHome(html: string): MovieBoxCatalogRow[] {
  const rows = new Map<string, MovieBoxCatalogItem[]>();
  let activeSection = "Trending Movies";

  const token =
    /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>|<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html))) {
    if (match[1]) {
      const section = cleanSection(match[2] ?? "");
      if (section) activeSection = section;
      continue;
    }

    const rawHref = match[4] ?? "";
    const href = safeAbsolute(rawHref);
    if (!href || !href.startsWith(ORIGIN + "/detail/")) continue;

    const inner = match[6] ?? "";
    const title = titleFromAnchor(inner, href);
    if (!title || title.length < 2) continue;

    const kind = sectionKind(activeSection);
    const item: MovieBoxCatalogItem = {
      id: idFromHref(href),
      title,
      href,
      image: imageFromAnchor(inner),
      kind,
      section: activeSection,
    };

    const items = rows.get(activeSection) ?? [];
    if (!items.some((candidate) => candidate.href === href)) {
      items.push(item);
      rows.set(activeSection, items);
    }
  }

  const result: MovieBoxCatalogRow[] = [];
  for (const [title, items] of rows) {
    if (!items.length) continue;
    result.push({
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      title,
      kind: sectionKind(title),
      items: items.slice(0, 24),
    });
  }

  return result.slice(0, 14);
}

function meta(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      '<meta\\b[^>]*(?:property|name)=["\']' +
        escaped +
        '["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',
      "i",
    ),
    new RegExp(
      '<meta\\b[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' +
        escaped +
        '["\'][^>]*>',
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value);
  }
  return "";
}

function detailText(html: string): string[] {
  return [...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter(Boolean);
}

function parseDetail(html: string, href: string): MovieBoxDetailPayload {
  const rawTitle = meta(html, "og:title") || meta(html, "twitter:title") || "";
  const title =
    rawTitle
      .replace(/^Watch\s+/i, "")
      .replace(/\s+Streaming Online on Moviebox.*$/i, "")
      .trim() || "Untitled";
  const description = meta(html, "og:description") || meta(html, "description") || "";
  const image = meta(html, "og:image") || meta(html, "twitter:image") || null;
  const blocks = detailText(html);

  const year = blocks.find((value) => /^(19|20)\d{2}$/.test(value)) ?? null;
  const runtime = blocks.find((value) => /^\d+\s*h(?:\s*\d+\s*m)?$/i.test(value)) ?? null;
  const ratingText = blocks.find((value) => /^\d(?:\.\d)?\s*\/\s*10$/.test(value));
  const rating = ratingText ? Number.parseFloat(ratingText) : null;

  const ignored = new Set([
    "Details",
    "Watch Online",
    "Watch in App",
    "Watch on TV",
    "Episodes",
    "Trailer",
    "Top Cast",
    "User Review",
    title,
    year ?? "",
    runtime ?? "",
    ratingText ?? "",
  ]);

  const genres = blocks
    .filter((value) => !ignored.has(value))
    .filter((value) => /^[A-Za-z][A-Za-z &-]{2,28}$/.test(value))
    .filter(
      (value) =>
        !["United States", "United Kingdom", "India", "Korea", "China", "Japan"].includes(value),
    )
    .slice(0, 4);

  return {
    title,
    description,
    image,
    year,
    rating: Number.isFinite(rating) ? rating : null,
    runtime,
    genres,
    href,
  };
}

async function publicFetch(url: string, timeout = 10_000): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 PinflixCatalog/1.0",
    },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error("MovieBox public page failed: " + response.status);
  }
  return response.text();
}

export async function getMovieBoxCatalog(): Promise<MovieBoxCatalogPayload> {
  const html = await publicFetch(HOME);
  const rows = parseHome(html);
  return {
    source: "moviebox-public",
    fetchedAt: new Date().toISOString(),
    rows,
  };
}

export async function getMovieBoxDetail(rawHref: string): Promise<MovieBoxDetailPayload> {
  const href = safeAbsolute(rawHref);
  if (!href || !href.startsWith(ORIGIN + "/detail/")) {
    throw new Error("Invalid MovieBox detail URL");
  }

  const html = await publicFetch(href, 12_000);
  return parseDetail(html, href);
}

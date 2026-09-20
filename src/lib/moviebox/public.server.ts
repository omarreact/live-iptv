import "server-only";

import type {
  MovieBoxCatalogItem,
  MovieBoxCatalogPayload,
  MovieBoxCatalogRow,
  MovieBoxDetailPayload,
  MovieBoxKind,
} from "./types";

const ORIGIN = "https://themoviebox.xyz";

type PageSpec = {
  path: string;
  kind: MovieBoxKind;
  sections: Array<{ label: string; aliases: string[] }>;
};

const PAGE_SPECS: PageSpec[] = [
  {
    path: "/web/movie",
    kind: "movie",
    sections: [
      { label: "Trending Movies", aliases: ["trending movie", "trending movies"] },
      { label: "Action", aliases: ["action"] },
      { label: "Comedies", aliases: ["comedies", "comedy"] },
      { label: "Animation Movies", aliases: ["animation"] },
      { label: "Marvel Movies", aliases: ["marvel movies"] },
      { label: "DC Movies", aliases: ["dc movies"] },
      { label: "Adventure", aliases: ["adventure"] },
      { label: "IMDb Top 250", aliases: ["imdb top250", "imdb top 250"] },
      { label: "Zombie & Apocalypse", aliases: ["zombies attacking", "the end of the world"] },
      { label: "Horror & Thriller", aliases: ["horror", "thriller", "midnight horror"] },
    ],
  },
  {
    path: "/web/tv-series",
    kind: "series",
    sections: [
      { label: "Trending TV", aliases: ["trending drama", "trending tv", "trending series"] },
      { label: "Western TV", aliases: ["western tv"] },
      { label: "K-Drama", aliases: ["k-drama", "k drama", "korean drama"] },
      { label: "C-Drama", aliases: ["c-drama", "c drama", "chinese drama"] },
      { label: "Popular Series", aliases: ["popular series", "popular tv"] },
      { label: "Fantasy Series", aliases: ["fantasy", "fantasy world"] },
      { label: "Superhero Series", aliases: ["superhero", "marvel series", "dc series"] },
    ],
  },
  {
    path: "/web/animated-series",
    kind: "series",
    sections: [
      { label: "Trending Animation", aliases: ["trending", "animated", "animation"] },
      { label: "Anime", aliases: ["anime", "animeverse"] },
      { label: "Adult Animation", aliases: ["adult animation"] },
      { label: "Family Animation", aliases: ["family", "kids"] },
    ],
  },
];

const GENRES = new Set([
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Film-Noir",
  "Game-Show",
  "History",
  "Horror",
  "Music",
  "Musical",
  "Mystery",
  "News",
  "Reality-TV",
  "Romance",
  "Sci-Fi",
  "Short",
  "Sport",
  "Talk-Show",
  "Thriller",
  "War",
  "Western",
]);

const COUNTRIES = new Set([
  "United States",
  "United Kingdom",
  "Korea",
  "Japan",
  "Bangladesh",
  "China",
  "Egypt",
  "France",
  "Germany",
  "India",
  "Indonesia",
  "Iraq",
  "Italy",
  "Ivory Coast",
  "Kenya",
  "Lebanon",
  "Mexico",
  "Morocco",
  "Nigeria",
  "Pakistan",
  "Philippines",
  "Russia",
  "Saudi Arabia",
  "South Africa",
  "Spain",
  "Syria",
  "Thailand",
  "Malaysia",
  "Turkey",
]);

const BLOCKED_TERMS = [
  "porn",
  "xxx",
  "hentai",
  "creampie",
  "gangbang",
  "golden shower",
  "piss",
  "masturbat",
  "cum ",
  "cum-",
  "anal sex",
  "strap-on",
  "strapon",
  "sex in public",
  "explicit",
  "erotic tutoring",
  "lustful",
  "sex life",
  "sex drive",
  "kamasutra",
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

function normalizeHeading(value: string): string {
  return stripHtml(value)
    .replace(/[🔥🎬🎉🌟💀💗⚡👑🏜️💭]+/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function externalImage(raw: string): string | null {
  try {
    const url = new URL(decodeHtml(raw), ORIGIN);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function imageFromAnchor(inner: string): string | null {
  const match =
    inner.match(/<img\b[^>]*(?:data-src|data-original|data-lazy-src|src)\s*=\s*["']([^"']+)["']/i) ??
    inner.match(/(?:background-image|background)\s*:[^;]*url\((?:["']?)([^)"']+)/i);
  return match?.[1] ? externalImage(match[1]) : null;
}

function titleFromAnchor(inner: string, href: string): string {
  const preferred =
    inner.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1] ??
    inner.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ??
    stripHtml(inner);

  const decoded = decodeHtml(preferred || "")
    .replace(/^English\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
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

function safeTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return !BLOCKED_TERMS.some((term) => lower.includes(term));
}

function findSection(
  raw: string,
  sections: PageSpec["sections"],
): PageSpec["sections"][number] | null {
  const heading = normalizeHeading(raw);
  if (!heading) return null;

  for (const section of sections) {
    for (const alias of section.aliases) {
      const normalizedAlias = normalizeHeading(alias);
      if (heading === normalizedAlias || heading.includes(normalizedAlias)) {
        return section;
      }
    }
  }
  return null;
}

function parseCategoryPage(html: string, spec: PageSpec): MovieBoxCatalogRow[] {
  const rows = new Map<string, MovieBoxCatalogItem[]>();
  let activeSection: PageSpec["sections"][number] | null = null;

  const token =
    /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>|<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html))) {
    if (match[1]) {
      activeSection = findSection(match[2] ?? "", spec.sections);
      continue;
    }

    if (!activeSection) continue;

    const href = safeAbsolute(match[4] ?? "");
    if (!href || !href.startsWith(ORIGIN + "/detail/")) continue;

    const inner = match[6] ?? "";
    const title = titleFromAnchor(inner, href);
    if (!title || title.length < 2 || !safeTitle(title)) continue;

    const row = rows.get(activeSection.label) ?? [];
    if (row.some((candidate) => candidate.href === href)) continue;

    row.push({
      id: idFromHref(href),
      title,
      href,
      image: imageFromAnchor(inner),
      kind: spec.kind,
      section: activeSection.label,
    });
    rows.set(activeSection.label, row);
  }

  return spec.sections
    .map((section) => ({
      id: section.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      title: section.label,
      kind: spec.kind,
      items: (rows.get(section.label) ?? []).slice(0, 24),
    }))
    .filter((row) => row.items.length > 0);
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

  const yearIndex = blocks.findIndex((value) => /^(19|20)\d{2}$/.test(value));
  const year = yearIndex >= 0 ? blocks[yearIndex] : null;
  const detailWindow = yearIndex >= 0 ? blocks.slice(yearIndex + 1, yearIndex + 10) : blocks.slice(0, 10);
  const runtime = detailWindow.find((value) => /^\d+\s*h(?:\s*\d+\s*m)?$/i.test(value)) ?? null;
  const country = detailWindow.find((value) => COUNTRIES.has(value)) ?? null;
  const genres = detailWindow.filter((value) => GENRES.has(value)).slice(0, 4);
  const ratingText = blocks.find((value) => /^\d(?:\.\d)?\s*\/\s*10$/.test(value));
  const rating = ratingText ? Number.parseFloat(ratingText) : null;

  return {
    title,
    description,
    image,
    year,
    rating: Number.isFinite(rating) ? rating : null,
    runtime,
    genres,
    country,
    href,
  };
}

async function publicFetch(url: string, timeout = 10_000): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 PinflixCatalog/1.1",
    },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) throw new Error("MovieBox public page failed: " + response.status);
  return response.text();
}

export async function getMovieBoxCatalog(): Promise<MovieBoxCatalogPayload> {
  const results = await Promise.all(
    PAGE_SPECS.map(async (spec) => {
      try {
        const html = await publicFetch(ORIGIN + spec.path, 12_000);
        return parseCategoryPage(html, spec);
      } catch {
        return [] as MovieBoxCatalogRow[];
      }
    }),
  );

  const seen = new Set<string>();
  const rows: MovieBoxCatalogRow[] = [];
  for (const group of results) {
    for (const row of group) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  return {
    source: "moviebox-public",
    fetchedAt: new Date().toISOString(),
    rows: rows.slice(0, 18),
  };
}

export async function getMovieBoxDetail(rawHref: string): Promise<MovieBoxDetailPayload> {
  const href = safeAbsolute(rawHref);
  if (!href || !href.startsWith(ORIGIN + "/detail/")) {
    throw new Error("Invalid MovieBox detail URL");
  }

  const html = await publicFetch(href, 12_000);
  const detail = parseDetail(html, href);
  if (!safeTitle(detail.title)) throw new Error("Filtered title");
  return detail;
}

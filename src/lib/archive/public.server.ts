import type { MediaResolvePayload } from "@/lib/media/types";
import type { ArchiveCatalogPayload, ArchivePlayableItem } from "@/lib/archive/types";

const SEARCH_ENDPOINT = "https://archive.org/advancedsearch.php";
const METADATA_ENDPOINT = "https://archive.org/metadata/";
const DOWNLOAD_ENDPOINT = "https://archive.org/download/";
const IMAGE_ENDPOINT = "https://archive.org/services/img/";

const BLOCKED_TERMS = [
  "porn",
  "xxx",
  "nude",
  "nudity",
  "nudist",
  "naked",
  "erotic",
  "fetish",
  "striptease",
  "sex madness",
  "sexploitation",
  "explicit sex",
  "sexual exploitation",
  "rape",
  "incest",
  "graphic scenes of human suffering",
  "concentration camps",
  "tortured by",
];

type ArchiveSearchDoc = {
  identifier?: string;
  title?: string | string[];
  description?: string | string[];
  year?: string | number;
  date?: string | string[];
  creator?: string | string[];
  downloads?: number;
  licenseurl?: string | string[];
};

type ArchiveSearchResponse = {
  response?: {
    docs?: ArchiveSearchDoc[];
  };
};

type ArchiveFile = {
  name?: string;
  format?: string;
  source?: string;
  size?: string;
  length?: string;
  height?: string;
  width?: string;
};

type ArchiveMetadataResponse = {
  files?: ArchiveFile[];
  metadata?: {
    identifier?: string;
    title?: string | string[];
    creator?: string | string[];
    description?: string | string[];
    year?: string | number;
    date?: string | string[];
    licenseurl?: string | string[];
  };
};

function firstText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.find(Boolean) ?? "";
  return value ?? "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function safeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(trimmed)) {
    throw new Error("Invalid Internet Archive identifier.");
  }
  return trimmed;
}

function licenseAllowed(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("creativecommons.org/publicdomain") ||
    normalized.includes("creativecommons.org/licenses/") ||
    normalized.includes("creativecommons.org/publicdomain/zero")
  );
}

function licenseLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("publicdomain/zero") ||
    normalized.includes("/publicdomain/") ||
    normalized.includes("/licenses/publicdomain/")
  ) {
    return "Public domain / CC0";
  }
  return "Creative Commons";
}

function contentBlocked(title: string, description: string): boolean {
  const haystack = (title + " " + description).toLowerCase();
  return BLOCKED_TERMS.some((term) => haystack.includes(term));
}

function yearFromDoc(doc: ArchiveSearchDoc): string | null {
  if (doc.year !== undefined && doc.year !== null) return String(doc.year);
  const date = firstText(doc.date);
  const match = date.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
}

function encodeFilePath(name: string): string {
  return name.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function mimeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".ogv") || lower.endsWith(".ogg")) return "video/ogg";
  return "video/mp4";
}

function playableScore(file: ArchiveFile): number {
  const name = file.name?.toLowerCase() ?? "";
  const format = file.format?.toLowerCase() ?? "";
  const source = file.source?.toLowerCase() ?? "";
  const size = Number.parseInt(file.size ?? "0", 10);
  const height = Number.parseInt(file.height ?? "0", 10);

  if (!/\.(mp4|m4v|webm|ogv)$/i.test(name)) return -1000;
  if (/sample|trailer|preview|thumb|clip\b|spectrogram/i.test(name)) return -1000;
  if (Number.isFinite(size) && size > 0 && size < 5_000_000) return -1000;

  let score = 0;
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) score += 120;
  else if (name.endsWith(".webm")) score += 90;
  else if (name.endsWith(".ogv")) score += 60;

  if (format.includes("h.264")) score += 55;
  if (format.includes("mpeg4")) score += 45;
  if (source === "derivative") score += 25;
  if (/512kb|512k/i.test(name + " " + format)) score += 20;

  if (Number.isFinite(height) && height >= 360 && height <= 1080) {
    score += Math.min(20, Math.round(height / 60));
  }

  if (Number.isFinite(size) && size > 1_500_000_000) score -= 10;
  return score;
}

function choosePlayableFile(files: ArchiveFile[] | undefined): ArchiveFile | null {
  if (!files?.length) return null;
  const candidates = files
    .map((file) => ({ file, score: playableScore(file) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.file ?? null;
}

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Pinflix/1.0 (+https://iptv.pincodeit.com)",
    },
    next: { revalidate: revalidateSeconds },
  });

  if (!response.ok) throw new Error("Internet Archive request failed.");
  return (await response.json()) as T;
}

async function fetchMetadata(identifier: string): Promise<ArchiveMetadataResponse> {
  return fetchJson<ArchiveMetadataResponse>(
    METADATA_ENDPOINT + encodeURIComponent(safeIdentifier(identifier)),
    3600,
  );
}

function buildSearchQuery(query: string): string {
  const clauses = [
    "mediatype:movies",
    "collection:feature_films",
    "licenseurl:*",
    '(format:"h.264" OR format:"512Kb MPEG4" OR format:"MPEG4")',
  ];
  const tokens = query
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (tokens.length) {
    clauses.push("title:(" + tokens.map((token) => '"' + token.replace(/"/g, "") + '"').join(" AND ") + ")");
  }

  return clauses.join(" AND ");
}

function mapDoc(doc: ArchiveSearchDoc): ArchivePlayableItem | null {
  const identifier = doc.identifier?.trim() ?? "";
  const title = stripHtml(firstText(doc.title));
  const description = stripHtml(firstText(doc.description));
  const licenseUrl = firstText(doc.licenseurl);

  if (!identifier || !title || !licenseAllowed(licenseUrl)) return null;
  if (contentBlocked(title, description)) return null;

  return {
    identifier,
    title,
    description,
    year: yearFromDoc(doc),
    creator: stripHtml(firstText(doc.creator)) || null,
    downloads: Number.isFinite(doc.downloads) ? doc.downloads ?? null : null,
    poster: IMAGE_ENDPOINT + encodeURIComponent(identifier),
    licenseUrl,
    licenseLabel: licenseLabel(licenseUrl),
  };
}

export async function getArchivePlayableCatalog({
  query = "",
  sort = "popular",
  limit = 18,
}: {
  query?: string;
  sort?: "popular" | "latest";
  limit?: number;
} = {}): Promise<ArchiveCatalogPayload> {
  const params = new URLSearchParams();
  params.set("q", buildSearchQuery(query));
  for (const field of [
    "identifier",
    "title",
    "description",
    "year",
    "date",
    "creator",
    "downloads",
    "licenseurl",
  ]) {
    params.append("fl[]", field);
  }
  params.set("rows", "36");
  params.set("page", "1");
  params.append("sort[]", sort === "latest" ? "date desc" : "downloads desc");
  params.set("output", "json");

  const search = await fetchJson<ArchiveSearchResponse>(
    SEARCH_ENDPOINT + "?" + params.toString(),
    900,
  );

  const playable = (search.response?.docs ?? [])
    .map(mapDoc)
    .filter((item): item is ArchivePlayableItem => Boolean(item))
    .slice(0, Math.max(1, Math.min(limit, 24)));

  return {
    source: "internet-archive",
    fetchedAt: new Date().toISOString(),
    sort,
    query,
    items: playable,
  };
}

export async function resolveInternetArchiveMedia(identifier: string): Promise<MediaResolvePayload> {
  const safe = safeIdentifier(identifier);
  const metadata = await fetchMetadata(safe);
  const licenseUrl = firstText(metadata.metadata?.licenseurl);

  if (!licenseAllowed(licenseUrl)) {
    throw new Error("This Internet Archive item does not expose an allowed license marker.");
  }

  const title = stripHtml(firstText(metadata.metadata?.title)) || safe;
  const description = stripHtml(firstText(metadata.metadata?.description));
  if (contentBlocked(title, description)) {
    throw new Error("This Internet Archive item is not available in the Pinflix playable catalog.");
  }

  const selected = choosePlayableFile(metadata.files);
  const name = selected?.name ?? "";
  if (!selected || !name) {
    throw new Error("No browser-playable video file is available for this archive item.");
  }

  return {
    source: { id: "internet-archive", name: "Internet Archive" },
    title,
    path: safe,
    kind: "file",
    mimeType: mimeFor(name),
    directPlayable: true,
    url: DOWNLOAD_ENDPOINT + encodeURIComponent(safe) + "/" + encodeFilePath(name),
    transcodeUrl: "",
  };
}

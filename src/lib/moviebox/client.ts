import "server-only";

import type {
  MovieBoxItem,
  MovieBoxKind,
} from "./types";

const API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Referer: "https://moviebox.ph/",
  Origin: "https://moviebox.ph",
  "X-Client-Info": '{"timezone":"Asia/Dhaka"}',
  "X-Request-Lang": "en",
  Accept: "application/json",
  "Content-Type": "application/json",
  "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site",
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number"
    ? value
    : null;
}

function nestedRecord(
  record: JsonRecord | null,
  key: string,
): JsonRecord | null {
  return record ? asRecord(record[key]) : null;
}

function nestedString(
  record: JsonRecord | null,
  key: string,
): string | null {
  return record ? asString(record[key]) : null;
}

function readBearerToken(headerValue: string): string | null {
  try {
    const parsed = JSON.parse(headerValue) as unknown;
    const record = asRecord(parsed);
    return record ? asString(record.token) : null;
  } catch {
    return null;
  }
}

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 25 * 60 * 1000;

function updateCachedToken(token: string | null): void {
  if (!token) return;
  cachedToken = token;
  tokenFetchedAt = Date.now();
}

async function getBearerToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && now - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${API_BASE}/home?host=moviebox.ph`, {
      headers: DEFAULT_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const headerToken = response.headers.get("x-user");
    if (headerToken) {
      const token = readBearerToken(headerToken);
      if (token) {
        updateCachedToken(token);
        return token;
      }
    }

    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/token=([^;]+)/);
    const cookieToken = match?.[1] ?? null;

    if (cookieToken) {
      updateCachedToken(cookieToken);
      return cookieToken;
    }
  } catch (error: unknown) {
    console.error("[moviebox] token acquisition failed", error);
  }

  return cachedToken ?? "";
}

export type MovieBoxRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  searchParams?: Record<string, string | number | undefined>;
};

export async function movieboxRequest<T = unknown>(
  path: string,
  options: MovieBoxRequestOptions = {},
): Promise<T> {
  const token = await getBearerToken();

  const url = new URL(
    path.startsWith("http") ? path : `${API_BASE}${path}`,
  );

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (options.method === "POST" && options.body) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);

  const headerToken = response.headers.get("x-user");
  if (headerToken) {
    updateCachedToken(readBearerToken(headerToken));
  }

  if (!response.ok) {
    throw new Error(
      `MovieBox upstream error: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

function normalizeKind(
  value: unknown,
  fallbackKind?: MovieBoxKind,
): MovieBoxKind | undefined {
  if (
    value === "movie" ||
    value === "series" ||
    value === "animation" ||
    value === "mixed"
  ) {
    return value;
  }

  return fallbackKind;
}

export function normalizeItem(
  raw: unknown,
  fallbackKind?: MovieBoxKind,
): MovieBoxItem {
  const record = asRecord(raw);
  const cover = nestedRecord(record, "cover");
  const image = nestedRecord(record, "image");
  const releaseDate = nestedString(record, "releaseDate");

  return {
    name:
      nestedString(record, "title") ??
      nestedString(record, "name") ??
      "Untitled",
    poster_url:
      nestedString(cover, "url") ??
      nestedString(record, "poster_url") ??
      nestedString(image, "url"),
    slug:
      nestedString(record, "detailPath") ??
      nestedString(record, "slug"),
    subject_id:
      (record ? asStringOrNumber(record.subjectId) : null) ??
      (record ? asStringOrNumber(record.subject_id) : null),
    badge:
      nestedString(record, "corner") ??
      nestedString(record, "badge"),
    rating:
      (record ? asStringOrNumber(record.imdbRatingValue) : null) ??
      (record ? asStringOrNumber(record.rating) : null),
    year: releaseDate
      ? releaseDate.slice(0, 4)
      : nestedString(record, "year"),
    kind: normalizeKind(record?.kind, fallbackKind),
  };
}

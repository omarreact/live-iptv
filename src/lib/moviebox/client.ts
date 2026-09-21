import "server-only";

import type {
  MovieBoxItem,
  MovieBoxKind,
} from "./types";

const API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_BOOTSTRAP_TIMEOUT_MS = 5_000;

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
let tokenBootstrapInflight: Promise<string> | null = null;
const TOKEN_TTL_MS = 25 * 60 * 1000;

function updateCachedToken(token: string | null): void {
  if (!token) return;
  cachedToken = token;
  tokenFetchedAt = Date.now();
}

function currentToken(): string {
  if (!cachedToken) return "";
  if (Date.now() - tokenFetchedAt >= TOKEN_TTL_MS) return "";
  return cachedToken;
}

function captureResponseToken(response: Response): void {
  const headerToken = response.headers.get("x-user");
  if (headerToken) {
    updateCachedToken(readBearerToken(headerToken));
  }

  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookieToken = setCookie.match(/token=([^;]+)/)?.[1] ?? null;
  if (cookieToken) updateCachedToken(cookieToken);
}

async function bootstrapToken(): Promise<string> {
  const existing = currentToken();
  if (existing) return existing;
  if (tokenBootstrapInflight) return tokenBootstrapInflight;

  tokenBootstrapInflight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/home?host=moviebox.ph`, {
        headers: DEFAULT_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(TOKEN_BOOTSTRAP_TIMEOUT_MS),
      });
      captureResponseToken(response);
    } catch (error: unknown) {
      console.warn("[moviebox] optional token bootstrap unavailable", error);
    }

    return currentToken();
  })().finally(() => {
    tokenBootstrapInflight = null;
  });

  return tokenBootstrapInflight;
}

export type MovieBoxRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  searchParams?: Record<string, string | number | undefined>;
};

function requestInit(
  options: MovieBoxRequestOptions,
  token: string,
): RequestInit {
  return {
    method: options.method ?? "GET",
    headers: {
      ...DEFAULT_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.method === "POST" && options.body
      ? { body: JSON.stringify(options.body) }
      : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
}

async function requestOnce(
  url: URL,
  options: MovieBoxRequestOptions,
  token: string,
): Promise<Response> {
  const response = await fetch(url, requestInit(options, token));
  captureResponseToken(response);
  return response;
}

export async function movieboxRequest<T = unknown>(
  path: string,
  options: MovieBoxRequestOptions = {},
): Promise<T> {
  const url = new URL(
    path.startsWith("http") ? path : `${API_BASE}${path}`,
  );

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  // Most catalog endpoints are public. Do not block every cold Vercel
  // invocation on an extra /home token request before making the real call.
  let token = currentToken();
  let response = await requestOnce(url, options, token);

  // Only pay the token bootstrap cost when the upstream explicitly requires it.
  if (response.status === 401 || response.status === 403) {
    token = currentToken() || (await bootstrapToken());
    if (token) {
      response = await requestOnce(url, options, token);
    }
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

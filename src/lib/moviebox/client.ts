import "server-only";

const API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";

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

// Simple in-memory token cache (works well on Vercel for short-lived instances)
let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 25 * 60 * 1000; // 25 minutes

async function getBearerToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  try {
    const resp = await fetch(`${API_BASE}/home?host=moviebox.ph`, {
      headers: DEFAULT_HEADERS,
      next: { revalidate: 0 },
    });

    const xUser = resp.headers.get("x-user");
    if (xUser) {
      try {
        const parsed = JSON.parse(xUser);
        if (parsed?.token) {
          cachedToken = parsed.token;
          tokenFetchedAt = now;
          return cachedToken!;
        }
      } catch {
        // ignore parse error
      }
    }

    // Fallback: try set-cookie
    const setCookie = resp.headers.get("set-cookie") || "";
    const match = setCookie.match(/token=([^;]+)/);
    if (match?.[1]) {
      cachedToken = match[1];
      tokenFetchedAt = now;
      return cachedToken;
    }
  } catch (err) {
    console.error("[moviebox] token acquisition failed", err);
  }

  return cachedToken || "";
}

export async function movieboxRequest<
  T = any
>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, any>;
    searchParams?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const token = await getBearerToken();

  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
    next: { revalidate: 0 },
  };

  if (options.method === "POST" && options.body) {
    init.body = JSON.stringify(options.body);
  }

  const resp = await fetch(url.toString(), init);

  // Refresh token if server sends a new one
  const xUser = resp.headers.get("x-user");
  if (xUser) {
    try {
      const parsed = JSON.parse(xUser);
      if (parsed?.token) {
        cachedToken = parsed.token;
        tokenFetchedAt = Date.now();
      }
    } catch {
      // ignore
    }
  }

  if (!resp.ok) {
    throw new Error(`MovieBox upstream error: ${resp.status}`);
  }

  return resp.json() as Promise<T>;
}

export function normalizeItem(raw: any, fallbackKind?: string): import("./types").MovieBoxItem {
  return {
    name: raw.title || raw.name || "Untitled",
    poster_url: raw.cover?.url || raw.poster_url || raw.image?.url || null,
    slug: raw.detailPath || raw.slug || null,
    subject_id: raw.subjectId || raw.subject_id || null,
    badge: raw.corner || raw.badge || null,
    rating: raw.imdbRatingValue || raw.rating || null,
    year: raw.releaseDate ? String(raw.releaseDate).slice(0, 4) : raw.year || null,
    kind: (raw.kind as any) || (fallbackKind as any) || undefined,
  };
}

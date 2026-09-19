export type ViewerLocation = {
  country: string;
  city: string | null;
  region: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "edge" | "ip" | "unknown";
};

type HeaderReader = {
  get(name: string): string | null;
};

function clean(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveViewerLocation(
  headers: HeaderReader,
  fallbackCountry = "ZZ",
): ViewerLocation {
  const edgeCountry = clean(headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry"));
  const country = (edgeCountry ?? fallbackCountry).toUpperCase();

  return {
    country,
    city: clean(headers.get("x-vercel-ip-city")),
    region: clean(headers.get("x-vercel-ip-country-region")),
    timezone: clean(headers.get("x-vercel-ip-timezone")),
    latitude: numberOrNull(headers.get("x-vercel-ip-latitude")),
    longitude: numberOrNull(headers.get("x-vercel-ip-longitude")),
    source: edgeCountry ? "edge" : "unknown",
  };
}

function requestIp(headers: HeaderReader): string | null {
  const forwarded = clean(headers.get("x-forwarded-for"));
  const candidate = forwarded?.split(",")[0]?.trim() ?? clean(headers.get("x-real-ip"));
  if (!candidate || candidate.length > 64 || !/^[0-9a-f:.]+$/i.test(candidate)) return null;
  return candidate;
}

type IpWhoPayload = {
  success?: boolean;
  country_code?: string;
  city?: string;
  region?: string;
  timezone?: { id?: string } | string;
  latitude?: number;
  longitude?: number;
};

/**
 * Geo gating uses Vercel's country header first. Only when that header is absent
 * do we make a short, best-effort IP-country lookup. Unknown traffic never
 * defaults to Bangladesh.
 */
export async function resolveViewerLocationWithIpFallback(
  headers: HeaderReader,
): Promise<ViewerLocation> {
  const edge = resolveViewerLocation(headers);
  if (edge.country !== "ZZ") return edge;

  const ip = requestIp(headers);
  if (!ip) return edge;

  try {
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,city,region,timezone,latitude,longitude`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(1_200),
        cache: "no-store",
      },
    );
    if (!response.ok) return edge;
    const data = (await response.json()) as IpWhoPayload;
    const code = data.country_code?.trim().toUpperCase();
    if (data.success === false || !code || !/^[A-Z]{2}$/.test(code)) return edge;

    const timezone =
      typeof data.timezone === "string"
        ? data.timezone
        : typeof data.timezone?.id === "string"
          ? data.timezone.id
          : null;

    return {
      country: code,
      city: typeof data.city === "string" ? data.city : null,
      region: typeof data.region === "string" ? data.region : null,
      timezone,
      latitude: typeof data.latitude === "number" ? data.latitude : null,
      longitude: typeof data.longitude === "number" ? data.longitude : null,
      source: "ip",
    };
  } catch {
    return edge;
  }
}

export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

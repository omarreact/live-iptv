export type ViewerLocation = {
  country: string;
  city: string | null;
  region: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "edge" | "fallback";
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
  fallbackCountry = "BD",
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
    source: edgeCountry ? "edge" : "fallback",
  };
}

export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

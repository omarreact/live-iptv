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

/**
 * Bangladesh-only private streams use Vercel's platform-provided country
 * header. Unknown/non-Vercel requests fail closed instead of trusting
 * client-controlled forwarding headers or a third-party IP lookup.
 */
export function trustedViewerCountry(headers: HeaderReader): string {
  const value = clean(headers.get("x-vercel-ip-country"))?.toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(value) ? value : "ZZ";
}

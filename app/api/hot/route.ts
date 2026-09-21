import { getHotNow } from "@/lib/hot";
import { trustedViewerCountry } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCountry = url.searchParams.get("country")?.trim().toUpperCase();
  const trustedCountry = trustedViewerCountry(request.headers);
  const country = /^[A-Z]{2}$/.test(requestedCountry ?? "")
    ? requestedCountry!
    : trustedCountry;

  const items = await getHotNow(country).catch(() => []);

  return Response.json(
    { country, items },
    {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=180",
      },
    },
  );
}

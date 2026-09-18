import { getHotNow } from "@/lib/hot";
import { resolveViewerLocation } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCountry = url.searchParams.get("country")?.trim().toUpperCase();
  const location = resolveViewerLocation(request.headers);
  const country = /^[A-Z]{2}$/.test(requestedCountry ?? "")
    ? requestedCountry!
    : location.country;

  const items = await getHotNow(country).catch(() => []);

  return Response.json(
    { country, items },
    {
      headers: {
        "cache-control": "private, max-age=30",
      },
    },
  );
}

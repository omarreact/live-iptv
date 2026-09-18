import { getFastCountryChannels } from "@/lib/iptv/provider/multi";
import { countryName, resolveViewerLocation } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const location = resolveViewerLocation(request.headers);
  const result = await getFastCountryChannels(location.country, 18).catch(() => ({
    provider: "iptv-org" as const,
    channels: [],
  }));

  return Response.json(
    {
      location: {
        country: location.country,
        city: location.city,
        region: location.region,
        timezone: location.timezone,
        label: countryName(location.country),
      },
      provider: result.provider,
      channels: result.channels,
    },
    {
      headers: {
        "cache-control": "private, max-age=60",
      },
    },
  );
}

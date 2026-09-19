import { getBangladeshPrivatePreviews } from "@/lib/iptv/private-channels";
import { getFastCountryChannels } from "@/lib/iptv/provider/multi";
import { countryName, resolveViewerLocationWithIpFallback } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const location = await resolveViewerLocationWithIpFallback(request.headers);

  // Private Bangladesh channels are merged only after geo resolves to BD.
  const privateChannels =
    location.country === "BD" ? getBangladeshPrivatePreviews() : [];

  const result =
    location.country !== "ZZ"
      ? await getFastCountryChannels(location.country, 18).catch(() => ({
          provider: "iptv-org" as const,
          channels: [],
        }))
      : { provider: "iptv-org" as const, channels: [] };

  return Response.json(
    {
      location: {
        country: location.country,
        city: location.city,
        region: location.region,
        timezone: location.timezone,
        label: location.country === "ZZ" ? "your area" : countryName(location.country),
      },
      provider: result.provider,
      privateChannels,
      channels: result.channels,
    },
    {
      headers: {
        "cache-control": "private, max-age=60",
        vary: "x-vercel-ip-country",
      },
    },
  );
}

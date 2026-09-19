import {
  getBangladeshPrivatePreviews,
  getPrivateChannelsByCategory,
} from "@/lib/iptv/private-channels";
import { resolveViewerLocationWithIpFallback } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = await resolveViewerLocationWithIpFallback(request.headers);

  if (location.country !== "BD") {
    return Response.json([], {
      headers: {
        "cache-control": "private, max-age=60",
        vary: "x-vercel-ip-country",
      },
    });
  }

  const category = url.searchParams.get("category")?.trim().toLowerCase();
  const channels = category
    ? getPrivateChannelsByCategory(category)
    : getBangladeshPrivatePreviews();

  return Response.json(channels, {
    headers: {
      "cache-control": "private, max-age=60",
      vary: "x-vercel-ip-country",
    },
  });
}

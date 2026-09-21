import {
  getBangladeshPrivatePreviews,
  getPrivateChannelsByCategory,
} from "@/lib/iptv/private-channels";
import { trustedViewerCountry } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = trustedViewerCountry(request.headers);

  if (country !== "BD") {
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

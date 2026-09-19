import { searchPrivateChannels } from "@/lib/iptv/private-channels";
import { searchChannels } from "@/lib/iptv/provider/iptv-org";
import { resolveViewerLocationWithIpFallback } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return Response.json([], { headers: { "cache-control": "private, max-age=60" } });
  }

  try {
    const [rows, location] = await Promise.all([
      searchChannels(q, 60),
      resolveViewerLocationWithIpFallback(request.headers),
    ]);

    const privateRows = location.country === "BD" ? searchPrivateChannels(q, 20) : [];
    const seen = new Set<string>();
    const merged = [...privateRows, ...rows].filter((channel) => {
      if (seen.has(channel.id)) return false;
      seen.add(channel.id);
      return true;
    });

    return Response.json(merged.slice(0, 60), {
      headers: {
        "cache-control": location.country === "BD"
          ? "private, max-age=60"
          : "public, s-maxage=300, stale-while-revalidate=3600",
        vary: "x-vercel-ip-country",
      },
    });
  } catch (error) {
    console.error("Pinflix search failed", error);
    return Response.json(
      { error: "Search is temporarily unavailable" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

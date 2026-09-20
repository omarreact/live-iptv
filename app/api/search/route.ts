import { searchChannels } from "@/lib/iptv/provider/iptv-org";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return Response.json([], { headers: { "cache-control": "public, s-maxage=300" } });
  }

  try {
    const rows = await searchChannels(q, 60);
    return Response.json(rows, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
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

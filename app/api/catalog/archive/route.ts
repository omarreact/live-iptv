import { getArchivePlayableCatalog } from "@/lib/archive/public.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const sort = url.searchParams.get("sort") === "latest" ? "latest" : "popular";

  try {
    const payload = await getArchivePlayableCatalog({
      query,
      sort,
      limit: 18,
    });

    return Response.json(payload, {
      headers: {
        "cache-control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      {
        source: "internet-archive",
        fetchedAt: new Date().toISOString(),
        sort,
        query,
        items: [],
        error: "Internet Archive playable catalog is temporarily unavailable.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

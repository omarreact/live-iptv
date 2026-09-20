import { getMovieBoxCatalog } from "@/lib/moviebox/public.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await getMovieBoxCatalog();
    return Response.json(catalog, {
      headers: {
        "cache-control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      {
        source: "moviebox-public",
        fetchedAt: new Date().toISOString(),
        rows: [],
        error: "Public MovieBox catalog is temporarily unavailable.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

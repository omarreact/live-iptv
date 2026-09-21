import { getMovies } from "@/lib/moviebox/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || "1");
  const sort = searchParams.get("sort") || "RECOMMEND";

  try {
    const data = await getMovies(page, sort);
    return Response.json(data, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to load movies" },
      { status: 502 },
    );
  }
}

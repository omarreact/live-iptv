import { getMovieBoxDetail } from "@/lib/moviebox/public.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const href = url.searchParams.get("href") ?? "";

  try {
    const detail = await getMovieBoxDetail(href);
    return Response.json(detail, {
      headers: {
        "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json(
      { error: "Title metadata is unavailable." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}

import { search } from "@/lib/moviebox/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Number(searchParams.get("page") || "1");

  if (!q) {
    return Response.json({ query: "", page: 1, items: [], total: 0 });
  }

  try {
    const data = await search(q, page);
    return Response.json(data, {
      headers: {
        "cache-control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 502 });
  }
}

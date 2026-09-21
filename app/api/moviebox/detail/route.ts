import { getDetail } from "@/lib/moviebox/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") || searchParams.get("detailPath") || "").trim();

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const data = await getDetail(slug);
    return Response.json(data, {
      headers: {
        "cache-control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("[moviebox] detail failed", err);
    return Response.json({ error: "Failed to load detail" }, { status: 502 });
  }
}

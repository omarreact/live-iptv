import { getStreamSources } from "@/lib/moviebox/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subject_id") || searchParams.get("id") || "";
  const detailPath =
    searchParams.get("detail_path") || searchParams.get("slug") || "";
  const se = Number(searchParams.get("se") || "1");
  const ep = Number(searchParams.get("ep") || "1");

  if (!subjectId || !detailPath) {
    return Response.json(
      { error: "Missing subject_id or detail_path" },
      { status: 400 },
    );
  }

  try {
    const data = await getStreamSources(subjectId, detailPath, se, ep);
    return Response.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[moviebox] stream failed", err);
    return Response.json({ error: "Failed to resolve stream" }, { status: 502 });
  }
}

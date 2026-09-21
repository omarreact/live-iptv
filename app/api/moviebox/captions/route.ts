import { getPlaybackProvider } from "@/lib/providers/registry.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function integerParam(value: string | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000
    ? parsed
    : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId =
    searchParams.get("subject_id") || searchParams.get("id") || "";
  const detailPath =
    searchParams.get("detail_path") || searchParams.get("slug") || "";
  const se = integerParam(searchParams.get("se"), 1);
  const ep = integerParam(searchParams.get("ep"), 1);

  if (
    !subjectId ||
    !detailPath ||
    subjectId.length > 256 ||
    detailPath.length > 512
  ) {
    return Response.json(
      { error: "Invalid subject_id or detail_path" },
      { status: 400 },
    );
  }

  try {
    const result = await getPlaybackProvider("moviebox").resolve({
      id: subjectId,
      slug: detailPath,
      season: se,
      episode: ep,
    });

    const captions = result.subtitles.map((subtitle, index) => {
      const params = new URLSearchParams({
        provider: "moviebox",
        id: subjectId,
        slug: detailPath,
        season: String(se),
        episode: String(ep),
        subtitle: String(index),
      });

      return {
        label: subtitle.label,
        language: subtitle.language,
        url: `/api/playback/subtitle?${params.toString()}`,
        format: "vtt",
      };
    });

    return Response.json(
      {
        subject_id: subjectId,
        se,
        ep,
        count: captions.length,
        captions,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("[moviebox] legacy captions failed", error);
    return Response.json(
      { error: "Failed to load captions" },
      { status: 502 },
    );
  }
}

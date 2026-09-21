import { getPlaybackProvider } from "@/lib/providers/registry.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function integerParam(value: string | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000
    ? parsed
    : fallback;
}

function mediaParams(
  subjectId: string,
  detailPath: string,
  se: number,
  ep: number,
  key: "source" | "subtitle",
  index: number,
): string {
  const params = new URLSearchParams({
    provider: "moviebox",
    id: subjectId,
    slug: detailPath,
    season: String(se),
    episode: String(ep),
    [key]: String(index),
  });
  return params.toString();
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

    const sources = result.sources.flatMap((source, index) => {
      const hasProtectedHeaders =
        source.headers && Object.keys(source.headers).length > 0;

      if (source.protocol === "mp4") {
        return [{
          id: String(index),
          quality: source.quality,
          url: `/api/playback/proxy?${mediaParams(
            subjectId,
            detailPath,
            se,
            ep,
            "source",
            index,
          )}`,
          type: "mp4",
        }];
      }

      if (hasProtectedHeaders) return [];

      return [{
        id: String(index),
        quality: source.quality,
        url: source.url,
        type: source.protocol,
      }];
    });

    const subtitles = result.subtitles.map((subtitle, index) => ({
      label: subtitle.label,
      language: subtitle.language,
      url: `/api/playback/subtitle?${mediaParams(
        subjectId,
        detailPath,
        se,
        ep,
        "subtitle",
        index,
      )}`,
    }));

    return Response.json(
      {
        subject_id: subjectId,
        se,
        ep,
        sources,
        subtitles,
        has_resource: sources.length > 0,
        hls: [],
        dash: [],
        limited: false,
        note: sources.length ? null : "No browser-safe stream found for this episode.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("[moviebox] legacy stream failed", error);
    return Response.json(
      { error: "Failed to resolve stream" },
      { status: 502 },
    );
  }
}

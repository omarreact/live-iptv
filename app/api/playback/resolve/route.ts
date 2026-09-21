import { getPlaybackProvider } from "@/lib/providers/registry.server";
import type { BrowserPlaybackResult, PlaybackResult } from "@/types/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function toBrowserResult(result: PlaybackResult): BrowserPlaybackResult {
  return {
    title: result.title,
    sources: result.sources.map((source) => {
      if (source.headers && Object.keys(source.headers).length > 0) {
        throw new Error(
          "Protected playback headers require a server-side media gateway before browser playback.",
        );
      }

      return {
        url: source.url,
        protocol: source.protocol,
        quality: source.quality,
        mimeType: source.mimeType,
      };
    }),
    subtitles: result.subtitles,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("provider") ?? "";
  const id = searchParams.get("id") ?? "";
  const slug = searchParams.get("slug") ?? undefined;

  if (!providerId || !id) {
    return Response.json({ error: "provider and id are required" }, { status: 400 });
  }

  try {
    const provider = getPlaybackProvider(providerId);
    const result = await provider.resolve({
      id,
      slug,
      season: optionalInteger(searchParams.get("season")),
      episode: optionalInteger(searchParams.get("episode")),
    });

    return Response.json(toBrowserResult(result), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error: unknown) {
    console.error("[playback.resolve] failed", error);
    return Response.json({ error: "Unable to resolve playback" }, { status: 502 });
  }
}

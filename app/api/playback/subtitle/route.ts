import { assertSafeUrl } from "@/lib/iptv/proxy.server";
import { getPlaybackProvider } from "@/lib/providers/registry.server";
import type { ResolvePlaybackInput } from "@/lib/providers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SUBTITLE_BYTES = 5 * 1024 * 1024;

function optionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function srtToVtt(input: string): string {
  const normalized = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (/^WEBVTT(?:\s|$)/i.test(normalized)) {
    return normalized + "\n";
  }

  const converted = normalized.replace(
    /(\d{1,2}:\d{2}:\d{2}),(\d{3})(\s*-->\s*)(\d{1,2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2$3$4.$5",
  );

  return "WEBVTT\n\n" + converted + "\n";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("provider") ?? "";
  const id = searchParams.get("id") ?? "";
  const slug = searchParams.get("slug") ?? undefined;
  const subtitleIndex = Number(searchParams.get("subtitle"));

  if (
    !providerId ||
    !id ||
    providerId.length > 64 ||
    id.length > 256 ||
    (slug && slug.length > 512) ||
    !Number.isInteger(subtitleIndex) ||
    subtitleIndex < 0 ||
    subtitleIndex > 100
  ) {
    return Response.json(
      { error: "Invalid subtitle request" },
      { status: 400 },
    );
  }

  const input: ResolvePlaybackInput = {
    id,
    slug,
    season: optionalInteger(searchParams.get("season")),
    episode: optionalInteger(searchParams.get("episode")),
  };

  try {
    const provider = getPlaybackProvider(providerId);
    const result = await provider.resolve(input);
    const subtitle = result.subtitles[subtitleIndex];

    if (!subtitle) {
      return Response.json({ error: "Subtitle not found" }, { status: 404 });
    }

    const target = assertSafeUrl(subtitle.url);
    const upstream = await fetch(target, {
      headers: {
        accept: "text/vtt,text/plain,application/x-subrip,*/*;q=0.5",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/148 Mobile Safari/537.36",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      return Response.json(
        { error: "Subtitle upstream unavailable" },
        { status: 502 },
      );
    }

    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_SUBTITLE_BYTES) {
      return Response.json({ error: "Subtitle file is too large" }, { status: 413 });
    }

    const text = await upstream.text();
    if (Buffer.byteLength(text, "utf8") > MAX_SUBTITLE_BYTES) {
      return Response.json({ error: "Subtitle file is too large" }, { status: 413 });
    }

    return new Response(srtToVtt(text), {
      headers: {
        "content-type": "text/vtt; charset=utf-8",
        "cache-control": "private, no-store",
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error: unknown) {
    console.error("[playback.subtitle] failed", error);
    return Response.json(
      { error: "Unable to load subtitle" },
      { status: 502 },
    );
  }
}

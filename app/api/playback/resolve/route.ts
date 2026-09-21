import { assertSafeUrl } from "@/lib/iptv/proxy.server";
import { getPlaybackProvider } from "@/lib/providers/registry.server";
import { resolveMovieBoxBridge } from "@/lib/moviebox/bridge.server";
import type {
  BrowserPlaybackResult,
  PlaybackResult,
  PlaybackSource,
} from "@/types/media";
import type { ResolvePlaybackInput } from "@/lib/providers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000
    ? parsed
    : undefined;
}

function proxyHref(
  providerId: string,
  input: ResolvePlaybackInput,
  sourceIndex: number,
): string {
  const params = new URLSearchParams({
    provider: providerId,
    id: input.id,
    source: String(sourceIndex),
  });

  if (input.slug) params.set("slug", input.slug);
  if (input.season !== undefined) params.set("season", String(input.season));
  if (input.episode !== undefined) params.set("episode", String(input.episode));

  return `/api/playback/proxy?${params.toString()}`;
}

function subtitleHref(
  providerId: string,
  input: ResolvePlaybackInput,
  subtitleIndex: number,
): string {
  const params = new URLSearchParams({
    provider: providerId,
    id: input.id,
    subtitle: String(subtitleIndex),
  });

  if (input.slug) params.set("slug", input.slug);
  if (input.season !== undefined) params.set("season", String(input.season));
  if (input.episode !== undefined) params.set("episode", String(input.episode));

  return `/api/playback/subtitle?${params.toString()}`;
}

function browserSource(
  source: PlaybackSource,
  url = source.url,
): BrowserPlaybackResult["sources"][number] {
  return {
    url,
    protocol: source.protocol,
    quality: source.quality,
    mimeType: source.mimeType,
  };
}


function toBridgeBrowserResult(
  input: ResolvePlaybackInput,
  result: PlaybackResult,
  sources: PlaybackSource[],
): BrowserPlaybackResult {
  return {
    title: result.title,
    sources: sources.flatMap((source) => {
      try {
        return [browserSource(source, assertSafeUrl(source.url).href)];
      } catch {
        return [];
      }
    }),
    subtitles: result.subtitles.map((subtitle, subtitleIndex) => ({
      ...subtitle,
      url: subtitleHref("moviebox", input, subtitleIndex),
    })),
    warnings: [
      "Playback is using the configured Pinflix media bridge.",
    ],
  };
}

function toBrowserResult(
  providerId: string,
  input: ResolvePlaybackInput,
  result: PlaybackResult,
): BrowserPlaybackResult {
  const warnings: string[] = [];
  const sources = result.sources.flatMap((source, sourceIndex) => {
    const hasProtectedHeaders =
      source.headers && Object.keys(source.headers).length > 0;

    let safeDirectUrl: string;
    try {
      safeDirectUrl = assertSafeUrl(source.url).href;
    } catch {
      warnings.push("An unsafe playback source was withheld.");
      return [];
    }

    const shouldRefreshThroughProxy =
      source.protocol === "mp4" &&
      (hasProtectedHeaders || providerId === "moviebox");

    if (shouldRefreshThroughProxy) {
      return [
        browserSource(
          source,
          proxyHref(providerId, input, sourceIndex),
        ),
      ];
    }

    if (!hasProtectedHeaders) {
      return [browserSource(source, safeDirectUrl)];
    }

    warnings.push(
      `${source.protocol.toUpperCase()} source requires a segment-aware server media gateway and was not exposed to the browser.`,
    );
    return [];
  });

  if (sources.length === 0) {
    warnings.push(
      result.sources.length === 0
        ? "The provider currently has no full stream for this selection."
        : "The available full streams require a media gateway that is not browser-safe yet.",
    );
  }

  return {
    title: result.title,
    sources,
    subtitles: result.subtitles.map((subtitle, subtitleIndex) => ({
      ...subtitle,
      url: subtitleHref(providerId, input, subtitleIndex),
    })),
    ...(warnings.length ? { warnings: [...new Set(warnings)] } : {}),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("provider") ?? "";
  const id = searchParams.get("id") ?? "";
  const slug = searchParams.get("slug") ?? undefined;

  if (
    !providerId ||
    !id ||
    providerId.length > 64 ||
    id.length > 256 ||
    (slug && slug.length > 512)
  ) {
    return Response.json(
      { error: "Invalid playback request" },
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

    let browserResult = toBrowserResult(providerId, input, result);

    if (providerId === "moviebox") {
      const bridgedSources = await resolveMovieBoxBridge(input);
      if (bridgedSources?.length) {
        browserResult = toBridgeBrowserResult(
          input,
          result,
          bridgedSources,
        );
      }
    }

    return Response.json(browserResult, {
      headers: {
        "cache-control": "private, no-store, no-cache, max-age=0, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "x-pinflix-playback-revision": "moviebox-bridge-v3",
      },
    });
  } catch (error: unknown) {
    console.error("[playback.resolve] failed", error);
    return Response.json(
      { error: "Unable to resolve playback" },
      { status: 502 },
    );
  }
}

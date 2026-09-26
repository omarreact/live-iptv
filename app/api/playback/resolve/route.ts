import { assertSafeUrl } from "@/lib/iptv/proxy.server";
import { getPlaybackProvider } from "@/lib/providers/registry.server";
import type { BrowserPlaybackResult, PlaybackResult, PlaybackSource } from "@/types/media";
import type { ResolvePlaybackInput } from "@/lib/providers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : undefined;
}

function proxyHref(providerId: string, input: ResolvePlaybackInput, sourceIndex: number): string {
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

function cineplexGatewayUrl(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const isCineplex =
    host === "cineplexbd.net" ||
    host === "www.cineplexbd.net" ||
    host === "vod.cineplexbd.net";

  if (!isCineplex || url.protocol !== "http:") return null;

  const edgeBase =
    process.env.CINEPLEX_MEDIA_EDGE_BASE?.trim() ||
    "https://media.pincodeit.com";
  const edge = new URL("/proxy", edgeBase);
  edge.searchParams.set("url", url.href);
  return edge.href;
}

function browserSource(
  source: PlaybackSource,
  url = source.url,
  quality = source.quality,
): BrowserPlaybackResult["sources"][number] {
  return {
    url,
    protocol: source.protocol,
    quality,
    mimeType: source.mimeType,
  };
}

function toBrowserResult(
  providerId: string,
  input: ResolvePlaybackInput,
  result: PlaybackResult,
): BrowserPlaybackResult {
  const warnings: string[] = [];
  const sources = result.sources.flatMap((source, sourceIndex) => {
    const hasProtectedHeaders = source.headers && Object.keys(source.headers).length > 0;

    let safeDirectUrl: string;
    try {
      safeDirectUrl = assertSafeUrl(source.url).href;
    } catch {
      warnings.push("An unsafe playback source was withheld.");
      return [];
    }

    const shouldRefreshThroughProxy =
      hasProtectedHeaders || (providerId === "moviebox" && source.protocol === "mp4");

    if (shouldRefreshThroughProxy) {
      return [browserSource(source, proxyHref(providerId, input, sourceIndex))];
    }

    if (providerId === "cineplex" && !hasProtectedHeaders) {
      const gatewayUrl = cineplexGatewayUrl(safeDirectUrl);
      const directQuality =
        source.quality && source.quality.toLowerCase() !== "auto"
          ? `${source.quality} · Direct`
          : "Direct network";

      const direct = browserSource(source, safeDirectUrl, directQuality);

      if (!gatewayUrl || gatewayUrl === safeDirectUrl) {
        return [direct];
      }

      warnings.push(
        "CineplexBD direct playback is attempted from this device first. If the browser blocks HTTP/CORS or the local route is unavailable, Pinflix automatically tries the HTTPS gateway.",
      );

      return [
        direct,
        browserSource(source, gatewayUrl, "HTTPS gateway"),
      ];
    }

    return [browserSource(source, safeDirectUrl)];
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
    return Response.json({ error: "Invalid playback request" }, { status: 400 });
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

    const browserResult = toBrowserResult(providerId, input, result);

    return Response.json(browserResult, {
      headers: {
        "cache-control": "private, no-store, no-cache, max-age=0, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "x-pinflix-playback-revision": "cineplex-direct-client-v2",
      },
    });
  } catch (error: unknown) {
    console.error("[playback.resolve] failed", error);
    return Response.json({ error: "Unable to resolve playback" }, { status: 502 });
  }
}

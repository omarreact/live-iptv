"use client";

import Link from "next/link";
import { Captions, LoaderCircle, Play, Star, X } from "lucide-react";
import { useState } from "react";
import { AdaptivePlayer } from "@/components/media/adaptive-player";
import type { MovieBoxDetailView } from "@/lib/moviebox/types";
import { cn } from "@/lib/utils";
import type { BrowserPlaybackResult } from "@/types/media";

export function EntertainmentDetailPlayer({
  detail,
  closeHref,
}: {
  detail: MovieBoxDetailView;
  closeHref: string;
}) {
  const initialSeason = detail.seasons[0]?.se ?? 1;
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(1);
  const [playback, setPlayback] = useState<BrowserPlaybackResult | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSeason = detail.seasons.find((entry) => entry.se === season);
  const episodeCount = Math.max(1, activeSeason?.maxEp ?? 1);

  function resetPlayback(): void {
    setPlayback(null);
    setError(null);
  }

  function selectSeason(nextSeason: number): void {
    setSeason(nextSeason);
    setEpisode(1);
    resetPlayback();
  }

  function selectEpisode(nextEpisode: number): void {
    setEpisode(nextEpisode);
    resetPlayback();
  }

  async function play(): Promise<void> {
    if (!detail.subjectId || !detail.detailPath) {
      setError("This title does not currently expose a playable resource.");
      return;
    }

    setLoadingStream(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        provider: "moviebox",
        id: String(detail.subjectId),
        slug: detail.detailPath,
        season: String(season),
        episode: String(episode),
      });

      const response = await fetch(`/api/playback/resolve?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as BrowserPlaybackResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to resolve playback.");
      }

      setPlayback(payload);
    } catch (requestError: unknown) {
      setPlayback(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to resolve playback.",
      );
    } finally {
      setLoadingStream(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close details"
        className="absolute inset-0"
      />

      <section className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Entertainment
            </p>
            <h2 className="mt-0.5 line-clamp-1 text-lg font-bold">{detail.title}</h2>
          </div>

          <Link
            href={closeHref}
            scroll={false}
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
            aria-label="Close details"
          >
            <X className="size-5" />
          </Link>
        </div>

        <div className="overflow-y-auto">
          <div className="grid gap-6 p-4 sm:grid-cols-[180px_1fr] sm:p-6 lg:grid-cols-[220px_1fr]">
            <div>
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface">
                {detail.poster ? (
                  <img
                    src={detail.poster}
                    alt={detail.title}
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {detail.year ? <span>{detail.year}</span> : null}

                {detail.rating !== null ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-current text-amber-400" />
                    {detail.rating}
                  </span>
                ) : null}

                {detail.genre ? <span>{detail.genre}</span> : null}
              </div>

              {detail.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                  {detail.description}
                </p>
              ) : null}

              {detail.seasons.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">
                    Season
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detail.seasons.map((entry) => (
                      <button
                        type="button"
                        key={entry.se}
                        onClick={() => selectSeason(entry.se)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          entry.se === season
                            ? "bg-white text-black"
                            : "bg-surface text-muted hover:text-fg",
                        )}
                      >
                        {entry.se === 0 ? "Movie" : `S${entry.se}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {episodeCount > 1 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">
                    Episode
                  </p>
                  <div className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                    {Array.from({ length: episodeCount }, (_, index) => index + 1).map(
                      (value) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => selectEpisode(value)}
                          className={cn(
                            "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold",
                            episode === value
                              ? "bg-brand text-white"
                              : "bg-surface text-muted hover:text-fg",
                          )}
                        >
                          E{value}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void play()}
                  disabled={loadingStream || !detail.subjectId || !detail.detailPath}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loadingStream ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4 fill-current" />
                  )}
                  {loadingStream ? "Resolving…" : playback ? "Reload stream" : "Play"}
                </button>

                {playback?.subtitles.length ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-muted">
                    <Captions className="size-4" />
                    {playback.subtitles.length} subtitles
                  </span>
                ) : null}
              </div>

              {error ? (
                <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              {playback?.warnings?.length ? (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {playback.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              {playback && playback.sources.length === 0 ? (
                <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                  <p className="font-semibold text-fg">Playback unavailable</p>
                  <p className="mt-1 text-sm text-muted">
                    This provider did not return a source that Pinflix can safely play in the browser.
                  </p>

                  {detail.trailer ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">
                        Trailer / preview
                      </p>
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full rounded-xl bg-black"
                        src={detail.trailer}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {playback && playback.sources.length > 0 ? (
                <div className="mt-5">
                  <AdaptivePlayer
                    key={`${detail.subjectId}-${season}-${episode}`}
                    result={playback}
                    poster={detail.poster ?? undefined}
                    autoPlay
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

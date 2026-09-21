"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Captions,
  Film,
  LoaderCircle,
  Play,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { AdaptivePlayer } from "@/components/media/adaptive-player";
import type { MediaDetail } from "@/types/catalog";
import { cn } from "@/lib/utils";
import type { BrowserPlaybackResult } from "@/types/media";

export function EntertainmentDetailPlayer({
  detail,
  closeHref,
}: {
  detail: MediaDetail;
  closeHref: string;
}) {
  const initialSeason =
    detail.playback?.defaultSeason ?? detail.seasons[0]?.number ?? 1;
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(
    detail.playback?.defaultEpisode ?? 1,
  );
  const [playback, setPlayback] = useState<BrowserPlaybackResult | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSeason = detail.seasons.find((entry) => entry.number === season);
  const episodeCount = Math.max(1, activeSeason?.episodeCount ?? 1);
  const canResolve = Boolean(detail.playback);
  const hasPlayableSource = Boolean(playback?.sources.length);

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
    if (!detail.playback) {
      setError("This title does not currently expose a playable resource.");
      return;
    }

    setLoadingStream(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        provider: detail.playback.provider,
        id: detail.playback.id,
        season: String(season),
        episode: String(episode),
      });
      if (detail.playback.slug) params.set("slug", detail.playback.slug);

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-5">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close details"
        className="absolute inset-0"
      />

      <section className="relative z-10 flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0b0b0d] shadow-2xl shadow-black/60 sm:max-h-[92dvh] sm:rounded-[28px]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b0b0d]/92 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
              Pinflix Entertainment
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold text-white sm:text-lg">
              {detail.title}
            </h2>
          </div>

          <Link
            href={closeHref}
            scroll={false}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close details"
          >
            <X className="size-5" />
          </Link>
        </header>

        <div className="overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
            {hasPlayableSource && playback ? (
              <div className="animate-in fade-in duration-300">
                <AdaptivePlayer
                  key={`${detail.id}-${season}-${episode}`}
                  result={playback}
                  poster={detail.poster ?? undefined}
                  autoPlay
                />
              </div>
            ) : null}

            <div
              className={cn(
                "grid gap-5 sm:grid-cols-[150px_1fr] sm:gap-6",
                hasPlayableSource ? "mt-6" : "",
              )}
            >
              <div className="hidden sm:block">
                <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl">
                  {detail.poster ? (
                    <img
                      src={detail.poster}
                      alt={detail.title}
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-white/20">
                      <Film className="size-10" />
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex gap-4 sm:hidden">
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {detail.poster ? (
                      <img
                        src={detail.poster}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-white/20">
                        <Film className="size-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 self-center">
                    <h3 className="line-clamp-2 text-xl font-bold leading-tight text-white">
                      {detail.title}
                    </h3>
                    <Metadata detail={detail} />
                  </div>
                </div>

                <div className="hidden sm:block">
                  <h3 className="text-2xl font-bold leading-tight text-white">
                    {detail.title}
                  </h3>
                  <Metadata detail={detail} />
                </div>

                {detail.overview ? (
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55 sm:text-[15px] sm:leading-7">
                    {detail.overview}
                  </p>
                ) : null}

                {detail.seasons.length > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                      Season
                    </p>
                    <div className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                      {detail.seasons.map((entry) => (
                        <button
                          type="button"
                          key={entry.number}
                          onClick={() => selectSeason(entry.number)}
                          className={cn(
                            "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition",
                            entry.number === season
                              ? "border-white bg-white text-black shadow-lg"
                              : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          {entry.number === 0 ? "Movie" : `Season ${entry.number}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {episodeCount > 1 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                      Episode
                    </p>
                    <div className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                      {Array.from(
                        { length: episodeCount },
                        (_, index) => index + 1,
                      ).map((value) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => selectEpisode(value)}
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-xl border text-xs font-bold transition",
                            episode === value
                              ? "border-brand bg-brand text-white shadow-lg shadow-brand/20"
                              : "border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => void play()}
                    disabled={loadingStream || !canResolve}
                    aria-busy={loadingStream}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:py-2.5"
                  >
                    {loadingStream ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : hasPlayableSource ? (
                      <RotateCcw className="size-4" />
                    ) : (
                      <Play className="size-4 fill-current" />
                    )}
                    {loadingStream
                      ? "Finding best source…"
                      : hasPlayableSource
                        ? "Reload source"
                        : "Play"}
                  </button>

                  {playback?.subtitles.length ? (
                    <span className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/50 sm:min-h-0 sm:rounded-full">
                      <Captions className="size-4" />
                      {playback.subtitles.length} subtitle
                      {playback.subtitles.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>

                {loadingStream && !playback ? (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <div className="aspect-video animate-pulse bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent" />
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-300">
                        <AlertTriangle className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-red-100">
                          Couldn’t start playback
                        </p>
                        <p className="mt-1 text-sm leading-6 text-red-100/60">
                          {error}
                        </p>
                        <button
                          type="button"
                          onClick={() => void play()}
                          className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-300/15 bg-red-300/10 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:bg-red-300/15"
                        >
                          <RotateCcw className="size-3.5" />
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {playback?.warnings?.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-100/70">
                    {playback.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}

                {playback && playback.sources.length === 0 ? (
                  <UnavailableState
                    hasTrailer={Boolean(detail.trailer)}
                    trailer={detail.trailer}
                    onRetry={() => void play()}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metadata({ detail }: { detail: MediaDetail }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-white/45 sm:text-sm">
      {detail.year ? <span>{detail.year}</span> : null}

      {detail.rating !== null ? (
        <>
          <span className="text-white/20">•</span>
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {detail.rating}
          </span>
        </>
      ) : null}

      {detail.genres.length ? (
        <>
          <span className="text-white/20">•</span>
          <span className="line-clamp-1">{detail.genres.join(" · ")}</span>
        </>
      ) : null}
    </div>
  );
}

function UnavailableState({
  hasTrailer,
  trailer,
  onRetry,
}: {
  hasTrailer: boolean;
  trailer: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/45">
            <Film className="size-5" />
          </span>

          <div className="min-w-0">
            <p className="font-bold text-white">Playback unavailable</p>
            <p className="mt-1 text-sm leading-6 text-white/50">
              Pinflix couldn’t find a browser-safe full stream for this title.
              You can retry, or watch the available preview below.
            </p>

            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-3.5" />
              Check again
            </button>
          </div>
        </div>
      </div>

      {hasTrailer && trailer ? (
        <div className="border-t border-white/10 bg-black">
          <div className="flex items-center justify-between px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
              Trailer / preview
            </p>
            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-white/40">
              Preview only
            </span>
          </div>

          <video
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black object-contain"
            src={trailer}
          />
        </div>
      ) : null}
    </div>
  );
}

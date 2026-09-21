"use client";

import Link from "next/link";
import { Captions, LoaderCircle, Play, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  MovieBoxCaptionResponse,
  MovieBoxDetailView,
  MovieBoxStreamResponse,
} from "@/lib/moviebox/types";
import { cn } from "@/lib/utils";

function qualityValue(value?: string): number {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

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
  const [stream, setStream] = useState<MovieBoxStreamResponse | null>(null);
  const [activeSource, setActiveSource] = useState(0);
  const [captions, setCaptions] = useState<MovieBoxCaptionResponse["captions"]>([]);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSeason = detail.seasons.find((entry) => entry.se === season);
  const episodeCount = Math.max(1, activeSeason?.maxEp ?? 1);

  const orderedSources = useMemo(
    () =>
      [...(stream?.sources ?? [])].sort(
        (a, b) => qualityValue(b.quality) - qualityValue(a.quality),
      ),
    [stream],
  );

  const selectedSource = orderedSources[activeSource] ?? null;

  function selectSeason(nextSeason: number): void {
    setSeason(nextSeason);
    setEpisode(1);
    setStream(null);
    setCaptions([]);
    setActiveSource(0);
    setError(null);
  }

  function selectEpisode(nextEpisode: number): void {
    setEpisode(nextEpisode);
    setStream(null);
    setCaptions([]);
    setActiveSource(0);
    setError(null);
  }

  async function play(): Promise<void> {
    if (!detail.subjectId || !detail.detailPath) {
      setError("This title does not currently expose a playable resource.");
      return;
    }

    setLoadingStream(true);
    setError(null);
    setCaptions([]);

    try {
      const params = new URLSearchParams({
        subject_id: String(detail.subjectId),
        detail_path: detail.detailPath,
        se: String(season),
        ep: String(episode),
      });

      const response = await fetch(`/api/moviebox/stream?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as MovieBoxStreamResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to resolve playback.");
      }

      setStream(payload);
      setActiveSource(0);

      if (payload.has_resource) {
        const actualSeason =
          typeof payload.se === "number" ? payload.se : season;
        const actualEpisode =
          typeof payload.ep === "number" ? payload.ep : episode;

        const captionParams = new URLSearchParams({
          subject_id: String(detail.subjectId),
          detail_path: detail.detailPath,
          se: String(actualSeason),
          ep: String(actualEpisode),
        });

        void fetch(`/api/moviebox/captions?${captionParams.toString()}`, {
          cache: "no-store",
        })
          .then(async (result) => {
            if (!result.ok) return null;
            return (await result.json()) as MovieBoxCaptionResponse;
          })
          .then((captionPayload) => {
            setCaptions(captionPayload?.captions ?? []);
          })
          .catch(() => {
            setCaptions([]);
          });
      }
    } catch (requestError: unknown) {
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
            <h2 className="mt-0.5 line-clamp-1 text-lg font-bold">
              {detail.title}
            </h2>
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
                  disabled={loadingStream || !detail.subjectId}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loadingStream ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4 fill-current" />
                  )}
                  {loadingStream ? "Resolving…" : "Play"}
                </button>

                {captions.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-muted">
                    <Captions className="size-4" />
                    {captions.length} subtitles
                  </span>
                ) : null}
              </div>

              {error ? (
                <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              {stream && !orderedSources.length && !stream.has_resource ? (
                <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm text-muted">
                    {stream.note ?? "No playback source is currently available."}
                  </p>

                  {detail.trailer ? (
                    <video
                      controls
                      playsInline
                      className="mt-3 w-full rounded-xl bg-black"
                      src={detail.trailer}
                    />
                  ) : null}
                </div>
              ) : null}

              {selectedSource ? (
                <div className="mt-5">
                  <video
                    key={selectedSource.url}
                    controls
                    autoPlay
                    playsInline
                    className="aspect-video w-full rounded-xl bg-black"
                    src={selectedSource.url}
                  >
                    {captions.map((caption, index) => {
                      const src = caption.url ?? caption.file ?? caption.src;
                      if (!src) return null;

                      return (
                        <track
                          key={String(src) + "-" + index}
                          kind="subtitles"
                          src={src}
                          srcLang={
                            caption.language ??
                            caption.lang ??
                            caption.lan ??
                            "en"
                          }
                          label={
                            caption.label ??
                            caption.lanName ??
                            caption.language ??
                            "Subtitle"
                          }
                          default={index === 0}
                        />
                      );
                    })}
                  </video>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {orderedSources.map((source, index) => (
                      <button
                        type="button"
                        key={source.url}
                        onClick={() => setActiveSource(index)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold",
                          activeSource === index
                            ? "bg-white text-black"
                            : "bg-surface text-muted hover:text-fg",
                        )}
                      >
                        {source.quality ?? source.type ?? `Source ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

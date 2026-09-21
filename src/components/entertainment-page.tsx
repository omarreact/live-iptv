"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Captions,
  Clapperboard,
  Home,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  Star,
  Tv,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MovieBoxCategoryResponse,
  MovieBoxHomeResponse,
  MovieBoxItem,
  MovieBoxStreamResponse,
} from "@/lib/moviebox/types";

type ViewId = "home" | "movies" | "series" | "animation";

const VIEWS: Array<{
  id: ViewId;
  label: string;
  icon: typeof Home;
  endpoint?: string;
}> = [
  { id: "home", label: "Home", icon: Home },
  { id: "movies", label: "Movies", icon: Clapperboard, endpoint: "/api/moviebox/movies" },
  { id: "series", label: "TV Series", icon: Tv, endpoint: "/api/moviebox/tv" },
  { id: "animation", label: "Animation", icon: Sparkles, endpoint: "/api/moviebox/animation" },
];

function qualityValue(value?: string) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function titleMeta(item: MovieBoxItem) {
  return [item.year, item.rating ? "★ " + item.rating : null]
    .filter(Boolean)
    .join(" · ");
}

function PosterCard({
  item,
  onSelect,
}: {
  item: MovieBoxItem;
  onSelect: (item: MovieBoxItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group min-w-0 text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:border-border-strong group-hover:shadow-xl">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-end bg-gradient-to-br from-white/10 to-transparent p-4">
            <span className="text-sm font-semibold text-fg">{item.name}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

        {item.badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
            {item.badge}
          </span>
        ) : null}

        <span className="absolute bottom-3 right-3 flex size-10 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="size-4 fill-current" />
        </span>
      </div>

      <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-fg">
        {item.name}
      </h3>
      <p className="mt-0.5 min-h-4 text-xs text-muted">{titleMeta(item)}</p>
    </button>
  );
}

function PosterGrid({
  items,
  onSelect,
}: {
  items: MovieBoxItem[];
  onSelect: (item: MovieBoxItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {items.map((item, index) => (
        <PosterCard
          key={String(item.subject_id || item.slug || item.name) + "-" + index}
          item={item}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function Hero({
  item,
  onSelect,
}: {
  item: MovieBoxItem;
  onSelect: (item: MovieBoxItem) => void;
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-surface">
      {item.poster_url ? (
        <img
          src={item.poster_url}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/45" />

      <div className="relative grid min-h-[330px] items-center gap-8 p-6 sm:grid-cols-[180px_1fr] sm:p-8 lg:min-h-[390px] lg:grid-cols-[220px_1fr] lg:p-10">
        <div className="mx-auto aspect-[2/3] w-[160px] overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl sm:w-full">
          {item.poster_url ? (
            <img
              src={item.poster_url}
              alt={item.name}
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : null}
        </div>

        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-brand">
            Featured on MovieBox
          </p>
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl lg:text-5xl">
            {item.name}
          </h1>
          {titleMeta(item) ? (
            <p className="mt-3 text-sm text-muted">{titleMeta(item)}</p>
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-[1.02]"
          >
            <Play className="size-4 fill-current" />
            View details
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: MovieBoxItem[];
  onSelect: (item: MovieBoxItem) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-bold tracking-tight text-fg">{title}</h2>
        <span className="text-xs text-muted">{items.length} titles</span>
      </div>
      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2 sm:gap-4">
        {items.map((item, index) => (
          <div
            key={String(item.subject_id || item.slug || item.name) + "-" + index}
            className="w-[132px] shrink-0 sm:w-[150px] lg:w-[166px]"
          >
            <PosterCard item={item} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailDialog({
  item,
  onClose,
}: {
  item: MovieBoxItem;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [stream, setStream] = useState<MovieBoxStreamResponse | null>(null);
  const [activeSource, setActiveSource] = useState(0);
  const [captions, setCaptions] = useState<any[]>([]);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoadingDetail(true);
      setError(null);
      try {
        if (!item.slug) throw new Error("This title has no detail path.");
        const response = await fetch(
          "/api/moviebox/detail?slug=" + encodeURIComponent(item.slug),
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load details.");
        setDetail(data);

        const firstSeason = data?.resource?.seasons?.[0]?.se;
        setSeason(typeof firstSeason === "number" ? firstSeason : 1);
        setEpisode(1);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load details.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingDetail(false);
      }
    }

    load();
    return () => controller.abort();
  }, [item.slug]);

  useEffect(() => {
    setStream(null);
    setCaptions([]);
    setActiveSource(0);
    setError(null);
  }, [season, episode]);

  const subject = detail?.subject || {};
  const seasons = detail?.resource?.seasons || [];
  const activeSeason = seasons.find((entry: any) => Number(entry?.se) === season);
  const episodeCount = Math.max(1, Number(activeSeason?.maxEp || 1));
  const subjectId = subject.subjectId || item.subject_id;
  const detailPath = subject.detailPath || item.slug;
  const title = subject.title || item.name;
  const description = subject.description || detail?.description || "";
  const genre = subject.genre || "";
  const year = subject.releaseDate ? String(subject.releaseDate).slice(0, 4) : item.year;
  const rating = subject.imdbRatingValue || item.rating;
  const poster = subject.cover?.url || item.poster_url;
  const trailer = subject.trailer?.videoAddress?.url || null;

  const orderedSources = useMemo(
    () =>
      [...(stream?.sources || [])].sort(
        (a, b) => qualityValue(b.quality) - qualityValue(a.quality),
      ),
    [stream],
  );

  const selectedSource = orderedSources[activeSource] || null;

  async function play() {
    if (!subjectId || !detailPath) {
      setError("MovieBox did not return a playable subject ID.");
      return;
    }

    setLoadingStream(true);
    setError(null);
    setCaptions([]);

    try {
      const params = new URLSearchParams({
        subject_id: String(subjectId),
        detail_path: String(detailPath),
        se: String(season),
        ep: String(episode),
      });

      const response = await fetch("/api/moviebox/stream?" + params.toString(), {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resolve stream.");
      setStream(data);
      setActiveSource(0);

      if (data?.has_resource) {
        const actualSeason = Number.isFinite(Number(data.se)) ? Number(data.se) : season;
        const actualEpisode = Number.isFinite(Number(data.ep)) ? Number(data.ep) : episode;
        const captionParams = new URLSearchParams({
          subject_id: String(subjectId),
          detail_path: String(detailPath),
          se: String(actualSeason),
          ep: String(actualEpisode),
        });

        fetch("/api/moviebox/captions?" + captionParams.toString(), {
          cache: "no-store",
        })
          .then((result) => result.json())
          .then((captionData) => setCaptions(captionData?.captions || []))
          .catch(() => setCaptions([]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve stream.");
    } finally {
      setLoadingStream(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              MovieBox
            </p>
            <h2 className="mt-0.5 line-clamp-1 text-lg font-bold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {loadingDetail ? (
            <div className="flex min-h-[440px] items-center justify-center">
              <LoaderCircle className="size-8 animate-spin text-muted" />
            </div>
          ) : (
            <div className="grid gap-6 p-4 sm:grid-cols-[180px_1fr] sm:p-6 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface">
                  {poster ? (
                    <img
                      src={poster}
                      alt={title}
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  {year ? <span>{year}</span> : null}
                  {rating ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-current text-amber-400" />
                      {rating}
                    </span>
                  ) : null}
                  {genre ? <span>{genre}</span> : null}
                </div>

                {description ? (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                    {description}
                  </p>
                ) : null}

                {seasons.length > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">
                      Season
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {seasons.map((entry: any) => {
                        const value = Number(entry?.se);
                        const active = value === season;
                        return (
                          <button
                            type="button"
                            key={String(value)}
                            onClick={() => {
                              setSeason(value);
                              setEpisode(1);
                            }}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                              active
                                ? "bg-white text-black"
                                : "bg-surface text-muted hover:text-fg",
                            )}
                          >
                            {value === 0 ? "Movie" : "S" + value}
                          </button>
                        );
                      })}
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
                            onClick={() => setEpisode(value)}
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
                    onClick={play}
                    disabled={loadingStream || !subjectId}
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
                      {stream.note || "MovieBox did not return a stream for this title."}
                    </p>
                    {trailer ? (
                      <video
                        controls
                        playsInline
                        className="mt-3 w-full rounded-xl bg-black"
                        src={trailer}
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
                      {captions.map((caption: any, index: number) => {
                        const src = caption.url || caption.file || caption.src;
                        if (!src) return null;
                        return (
                          <track
                            key={String(src) + "-" + index}
                            kind="subtitles"
                            src={src}
                            srcLang={caption.language || caption.lang || "en"}
                            label={caption.label || caption.language || "Subtitle"}
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
                          {source.quality || source.type || "Source " + (index + 1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function EntertainmentPageClient() {
  const [view, setView] = useState<ViewId>("home");
  const [home, setHome] = useState<MovieBoxHomeResponse | null>(null);
  const [catalog, setCatalog] = useState<MovieBoxCategoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchItems, setSearchItems] = useState<MovieBoxItem[] | null>(null);
  const [selected, setSelected] = useState<MovieBoxItem | null>(null);

  useEffect(() => {
    if (view !== "home") return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/moviebox/home", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!controller.signal.aborted) setHome(data);
      } catch {
        if (!controller.signal.aborted) {
          setHome({
            status: "error",
            sections: [],
            error: "MovieBox is unavailable right now.",
          });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [view]);

  useEffect(() => {
    if (view === "home") return;
    const config = VIEWS.find((entry) => entry.id === view);
    const endpoint = config?.endpoint;
    if (!endpoint) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setPage(1);
      try {
        const response = await fetch(endpoint + "?page=1", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!controller.signal.aborted) setCatalog(data);
      } catch {
        if (!controller.signal.aborted) {
          setCatalog({ page: 1, per_page: 24, total: 0, items: [] });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [view]);

  useEffect(() => {
    const clean = query.trim();
    if (!clean) {
      setSearchItems(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          "/api/moviebox/search?q=" + encodeURIComponent(clean),
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!controller.signal.aborted) setSearchItems(data.items || []);
      } catch {
        if (!controller.signal.aborted) setSearchItems([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function loadMore() {
    const config = VIEWS.find((entry) => entry.id === view);
    if (!config?.endpoint || !catalog || loadingMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const response = await fetch(config.endpoint + "?page=" + nextPage, {
        cache: "no-store",
      });
      const data = (await response.json()) as MovieBoxCategoryResponse;
      setCatalog({
        ...data,
        items: [...catalog.items, ...(data.items || [])],
      });
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  const banner = home?.sections?.find((section) => section.section === "Banner");
  const hero = banner?.items?.[0] || home?.sections?.[0]?.items?.[0] || null;
  const searchingMode = query.trim().length > 0;
  const canLoadMore =
    Boolean(catalog) && (catalog?.items.length || 0) < (catalog?.total || 0);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1500px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setView("home");
                setQuery("");
              }}
              className="flex items-center gap-2"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand font-black text-white">
                P
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-black tracking-[0.12em]">PINFLIX</p>
                <p className="text-[10px] text-muted">Powered by MovieBox API</p>
              </div>
            </button>

            <div className="ml-auto flex w-full max-w-xl items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies, series, anime…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-subtle"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          {!searchingMode ? (
            <nav className="hide-scrollbar mt-3 flex gap-1 overflow-x-auto">
              {VIEWS.map((entry) => {
                const Icon = entry.icon;
                const active = view === entry.id;
                return (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setView(entry.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition",
                      active
                        ? "bg-white text-black"
                        : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" />
                    {entry.label}
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        {searchingMode ? (
          <section>
            <div className="mb-5 flex items-center gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  Search
                </p>
                <h1 className="mt-1 text-2xl font-black">
                  Results for “{query.trim()}”
                </h1>
              </div>
              {searching ? (
                <LoaderCircle className="ml-auto size-5 animate-spin text-muted" />
              ) : null}
            </div>

            {searchItems === null || searching ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <LoaderCircle className="size-8 animate-spin text-muted" />
              </div>
            ) : searchItems.length ? (
              <PosterGrid items={searchItems} onSelect={setSelected} />
            ) : (
              <p className="py-20 text-center text-muted">No titles found.</p>
            )}
          </section>
        ) : loading ? (
          <div className="flex min-h-[520px] items-center justify-center">
            <LoaderCircle className="size-8 animate-spin text-muted" />
          </div>
        ) : view === "home" ? (
          <>
            {home?.status === "error" ? (
              <p className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {home.error}
              </p>
            ) : null}

            {hero ? <Hero item={hero} onSelect={setSelected} /> : null}

            {(home?.sections || [])
              .filter((section) => section.section !== "Banner")
              .map((section) => (
                <SectionRow
                  key={section.section}
                  title={section.section}
                  items={section.items}
                  onSelect={setSelected}
                />
              ))}
          </>
        ) : (
          <section>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                MovieBox catalog
              </p>
              <h1 className="mt-1 text-3xl font-black">
                {VIEWS.find((entry) => entry.id === view)?.label}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {catalog?.total ? catalog.total.toLocaleString() + " available titles" : "Browse titles"}
              </p>
            </div>

            {catalog?.items?.length ? (
              <>
                <PosterGrid items={catalog.items} onSelect={setSelected} />
                {canLoadMore ? (
                  <div className="mt-10 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-bold hover:border-border-strong disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : null}
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="py-20 text-center text-muted">No titles available.</p>
            )}
          </section>
        )}
      </main>

      {selected ? (
        <DetailDialog item={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

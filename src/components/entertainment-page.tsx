"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clapperboard,
  Film,
  Flame,
  Home,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MovieBoxHomeResponse,
  MovieBoxItem,
  MovieBoxSection,
  MovieBoxStreamResponse,
} from "@/lib/moviebox/types";

type TabId = "home" | "movies" | "tv" | "animation";

const TABS: Array<{ id: TabId; label: string; icon: typeof Home }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "movies", label: "Movies", icon: Clapperboard },
  { id: "tv", label: "TV Shows", icon: Tv },
  { id: "animation", label: "Animation", icon: Sparkles },
];

function PosterCard({
  item,
  onClick,
}: {
  item: MovieBoxItem;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-[130px] shrink-0 text-left sm:w-[150px] lg:w-[160px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/8 bg-elevated transition duration-200 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-end bg-gradient-to-br from-white/5 to-white/0 p-3">
            <p className="line-clamp-4 text-sm font-semibold leading-snug text-white/80">
              {item.name}
            </p>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-white text-black shadow-xl">
            <Play className="size-5 fill-current" />
          </span>
        </div>

        {item.rating ? (
          <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur">
            ★ {Number(item.rating).toFixed(1)}
          </div>
        ) : null}

        {item.badge ? (
          <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
            {item.badge}
          </div>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-1 text-sm font-medium text-fg">{item.name}</p>
      <p className="mt-0.5 text-xs text-subtle">
        {item.year ||
          (item.kind === "series"
            ? "Series"
            : item.kind === "animation"
              ? "Animation"
              : "Movie")}
      </p>
    </button>
  );
}

function SectionRow({
  section,
  onSelect,
}: {
  section: MovieBoxSection;
  onSelect: (item: MovieBoxItem) => void;
}) {
  if (!section.items?.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            {section.section}
          </h2>
          <p className="mt-0.5 text-xs text-subtle">{section.count} titles</p>
        </div>
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 sm:gap-4 sm:px-6 lg:px-8">
        {section.items.map((item, idx) => (
          <PosterCard
            key={`${item.subject_id || item.slug || item.name}-${idx}`}
            item={item}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </section>
  );
}

function DetailModal({
  item,
  onClose,
}: {
  item: MovieBoxItem;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stream, setStream] = useState<MovieBoxStreamResponse | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!item.slug) return;
    let cancelled = false;
    setLoadingDetail(true);
    setDetail(null);

    fetch(`/api/moviebox/detail?slug=${encodeURIComponent(item.slug)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.slug]);

  async function play() {
    if (!item.subject_id || !item.slug) {
      setStreamError("Missing subject_id or slug");
      return;
    }
    setLoadingStream(true);
    setStreamError(null);
    setStream(null);

    try {
      const params = new URLSearchParams({
        subject_id: String(item.subject_id),
        detail_path: item.slug,
        se: "1",
        ep: "1",
      });
      const res = await fetch(`/api/moviebox/stream?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stream failed");
      setStream(data);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      setLoadingStream(false);
    }
  }

  const bestSource =
    stream?.sources?.find((s) => s.url)?.url ||
    (stream as any)?.hls?.[0]?.url ||
    (stream as any)?.dash?.[0]?.url ||
    null;

  const description =
    detail?.description ||
    detail?.intro ||
    detail?.summary ||
    detail?.subject?.description ||
    null;

  const title =
    detail?.title || detail?.subject?.title || item.name || "Untitled";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-bg shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-4 border-b border-white/8 p-4 sm:p-5">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-elevated sm:h-36 sm:w-24">
            {item.poster_url ? (
              <img
                src={item.poster_url}
                alt=""
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug sm:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-subtle">
              {[item.year, item.kind, item.rating ? `★ ${item.rating}` : null]
                .filter(Boolean)
                .join(" • ")}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={play}
                disabled={loadingStream || !item.subject_id}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loadingStream ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4 fill-current" />
                )}
                {loadingStream ? "Resolving…" : "Play"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-fg"
              >
                Close
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-white/10 hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <LoaderCircle className="size-6 animate-spin text-muted" />
            </div>
          ) : description ? (
            <p className="text-sm leading-relaxed text-muted">{description}</p>
          ) : (
            <p className="text-sm text-muted">No description available.</p>
          )}

          {streamError && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {streamError}
            </p>
          )}

          {stream && (
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold">Streams</h3>

              {bestSource ? (
                <div className="space-y-2">
                  <video
                    key={bestSource}
                    controls
                    autoPlay
                    playsInline
                    className="w-full rounded-xl bg-black"
                    src={bestSource}
                  />
                  <p className="break-all text-[11px] text-subtle">{bestSource}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {(stream as any).note || "No playable source returned."}
                </p>
              )}

              {stream.sources?.length > 0 && (
                <ul className="space-y-1 text-xs text-subtle">
                  {stream.sources.map((s, i) => (
                    <li key={i}>
                      {s.quality || s.type || "source"}:{" "}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline"
                      >
                        open
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EntertainmentPageClient() {
  const [tab, setTab] = useState<TabId>("home");
  const [home, setHome] = useState<MovieBoxHomeResponse | null>(null);
  const [categoryItems, setCategoryItems] = useState<MovieBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MovieBoxItem[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MovieBoxItem | null>(null);

  const loadHome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/moviebox/home", { cache: "no-store" });
      const data = (await res.json()) as MovieBoxHomeResponse;
      setHome(data);
    } catch {
      setHome({ status: "error", sections: [], error: "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategory = useCallback(async (id: TabId) => {
    if (id === "home") return;
    setLoading(true);
    setCategoryItems([]);
    try {
      const endpoint =
        id === "movies"
          ? "/api/moviebox/movies"
          : id === "tv"
            ? "/api/moviebox/tv"
            : "/api/moviebox/animation";
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();
      setCategoryItems(data.items || []);
    } catch {
      setCategoryItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "home") {
      loadHome();
    } else {
      loadCategory(tab);
    }
  }, [tab, loadHome, loadCategory]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/moviebox/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await res.json();
        setSearchResults(data.items || []);
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const isSearching = query.trim().length > 0;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-white/6 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Film className="size-5 text-brand" />
              <h1 className="text-base font-bold tracking-wide">
                Movies & Series
              </h1>
            </div>

            <div className="ml-auto flex max-w-md flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search MovieBox…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {!isSearching && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition",
                      active
                        ? "bg-brand text-white"
                        : "bg-white/5 text-muted hover:bg-white/10 hover:text-fg",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] pb-24 pt-4">
        {isSearching && (
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                Results for “{query.trim()}”
              </h2>
              {searching && (
                <LoaderCircle className="size-4 animate-spin text-muted" />
              )}
            </div>

            {searchResults === null || searching ? (
              <div className="flex justify-center py-20">
                <LoaderCircle className="size-8 animate-spin text-muted" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="py-16 text-center text-muted">No results found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {searchResults.map((item, idx) => (
                  <PosterCard
                    key={`${item.subject_id || item.slug}-${idx}`}
                    item={item}
                    onClick={() => setSelected(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!isSearching && (
          <>
            {loading ? (
              <div className="flex justify-center py-24">
                <LoaderCircle className="size-8 animate-spin text-muted" />
              </div>
            ) : tab === "home" ? (
              <div className="space-y-2">
                {home?.status === "error" && (
                  <p className="px-4 text-sm text-red-400 sm:px-6">
                    {home.error || "Failed to load catalog"}
                  </p>
                )}
                {home?.sections?.map((section) => (
                  <SectionRow
                    key={section.section}
                    section={section}
                    onSelect={setSelected}
                  />
                ))}
                {!home?.sections?.length && home?.status !== "error" && (
                  <p className="py-20 text-center text-muted">
                    No content available right now.
                  </p>
                )}
              </div>
            ) : (
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="mb-5 flex items-center gap-2">
                  <Flame className="size-5 text-brand" />
                  <h2 className="text-xl font-semibold">
                    {tab === "movies"
                      ? "Movies"
                      : tab === "tv"
                        ? "TV Shows"
                        : "Animation"}
                  </h2>
                </div>

                {categoryItems.length === 0 ? (
                  <p className="py-16 text-center text-muted">No titles found.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {categoryItems.map((item, idx) => (
                      <PosterCard
                        key={`${item.subject_id || item.slug}-${idx}`}
                        item={item}
                        onClick={() => setSelected(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {selected && (
        <DetailModal item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

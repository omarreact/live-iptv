"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clapperboard,
  Film,
  Flame,
  Home,
  LoaderCircle,
  Search,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MovieBoxHomeResponse, MovieBoxItem, MovieBoxSection } from "@/lib/moviebox/types";

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
        {item.year || (item.kind === "series" ? "Series" : item.kind === "animation" ? "Animation" : "Movie")}
      </p>
    </button>
  );
}

function SectionRow({ section }: { section: MovieBoxSection }) {
  if (!section.items?.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{section.section}</h2>
          <p className="mt-0.5 text-xs text-subtle">{section.count} titles</p>
        </div>
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 sm:gap-4 sm:px-6 lg:px-8">
        {section.items.map((item, idx) => (
          <PosterCard key={`${item.subject_id || item.slug || item.name}-${idx}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export function EntertainmentPageClient() {
  const [tab, setTab] = useState<TabId>("home");
  const [home, setHome] = useState<MovieBoxHomeResponse | null>(null);
  const [categoryItems, setCategoryItems] = useState<MovieBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MovieBoxItem[] | null>(null);
  const [searching, setSearching] = useState(false);

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
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/6 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Film className="size-5 text-brand" />
              <h1 className="text-base font-bold tracking-wide">Movies & Series</h1>
            </div>

            <div className="ml-auto flex flex-1 max-w-md items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
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
        {/* Search Results */}
        {isSearching && (
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                Results for “{query.trim()}”
              </h2>
              {searching && <LoaderCircle className="size-4 animate-spin text-muted" />}
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
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Home / Category content */}
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
                  <SectionRow key={section.section} section={section} />
                ))}
                {!home?.sections?.length && home?.status !== "error" && (
                  <p className="py-20 text-center text-muted">No content available right now.</p>
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
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

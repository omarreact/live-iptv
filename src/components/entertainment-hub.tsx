"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Flame,
  Home,
  Info,
  LoaderCircle,
  Moon,
  Play,
  Plus,
  Search,
  Sparkles,
  Tv,
  Wifi,
  WifiOff,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { MediaBrowser } from "@/components/media-browser";
import type { MediaBrowsePayload, MediaItem, MediaSourceSummary } from "@/lib/media/types";
import type {
  MovieBoxCatalogItem,
  MovieBoxCatalogPayload,
  MovieBoxCatalogRow,
  MovieBoxDetailPayload,
} from "@/lib/moviebox/types";
import { cn } from "@/lib/utils";

type FilterId = "home" | "shows" | "movies" | "animation" | "trending" | "midnight" | "list";

type Match = {
  item: MediaItem;
  source: string;
};

const FILTERS: Array<{
  id: FilterId;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "Home", icon: Home },
  { id: "shows", label: "TV shows", icon: Tv },
  { id: "movies", label: "Movies", icon: Clapperboard },
  { id: "animation", label: "Animation", icon: Sparkles },
  { id: "trending", label: "Most watched", icon: Flame },
  { id: "midnight", label: "Midnight", icon: Moon },
  { id: "list", label: "My list", icon: Bookmark },
];

const LIST_KEY = "pinflix:entertainment:list";
const POSTER_CACHE = new Map<string, string | null>();

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*(?:19|20)\d{2}[^)]*\)/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(
      /\b(?:hindi|english|bangla|bengali|dual audio|dubbed|webrip|web-dl|bluray|blu-ray|hdrip|hd|cam|1080p|720p|480p|2160p|4k)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function cleanDisplayTitle(value: string): string {
  return value
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesFilter(row: MovieBoxCatalogRow, filter: FilterId): boolean {
  const text = (row.title + " " + row.kind).toLowerCase();
  if (filter === "home") return true;
  if (filter === "shows") return row.kind === "series" || text.includes("drama") || text.includes("tv");
  if (filter === "movies") return row.kind === "movie" || text.includes("movie") || text.includes("hollywood");
  if (filter === "animation") return text.includes("anime") || text.includes("animated") || text.includes("animation");
  if (filter === "trending") return text.includes("trending") || text.includes("recent") || text.includes("free now");
  if (filter === "midnight") return text.includes("horror") || text.includes("zombie") || text.includes("apocalypse");
  return true;
}

function dedupeItems(rows: MovieBoxCatalogRow[]): MovieBoxCatalogItem[] {
  const seen = new Set<string>();
  const result: MovieBoxCatalogItem[] = [];
  for (const row of rows) {
    for (const item of row.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function fallbackRows(rows: MovieBoxCatalogRow[]): MovieBoxCatalogRow[] {
  if (rows.length) return rows;
  return [
    {
      id: "catalog-unavailable",
      title: "MovieBox public catalog",
      kind: "mixed",
      items: [],
    },
  ];
}

function CatalogPoster({ item }: { item: MovieBoxCatalogItem }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(() => item.image ?? POSTER_CACHE.get(item.href) ?? null);
  const [ready, setReady] = useState(Boolean(item.image));

  useEffect(() => {
    if (item.image) {
      POSTER_CACHE.set(item.href, item.image);
      setImage(item.image);
      setReady(true);
      return;
    }

    if (POSTER_CACHE.has(item.href)) {
      const cached = POSTER_CACHE.get(item.href) ?? null;
      setImage(cached);
      setReady(Boolean(cached));
      return;
    }

    const node = wrapRef.current;
    if (!node) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const params = new URLSearchParams({ href: item.href });
        fetch("/api/catalog/moviebox/detail?" + params.toString(), { cache: "force-cache" })
          .then(async (response) => {
            if (!response.ok) throw new Error("poster unavailable");
            return response.json() as Promise<MovieBoxDetailPayload>;
          })
          .then((payload) => {
            if (cancelled) return;
            const poster = payload.image || null;
            POSTER_CACHE.set(item.href, poster);
            setImage(poster);
            setReady(Boolean(poster));
          })
          .catch(() => {
            if (!cancelled) POSTER_CACHE.set(item.href, null);
          });
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [item.href, item.image]);

  return (
    <div ref={wrapRef} className="size-full">
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn(
            "size-full object-cover transition duration-500 group-hover:scale-[1.035]",
            ready ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setReady(true)}
        />
      ) : (
        <div className="pinflix-shimmer flex size-full items-end p-3">
          <p className="line-clamp-4 text-sm font-semibold leading-snug text-white/85">{item.title}</p>
        </div>
      )}
    </div>
  );
}

function CinemaCard({
  item,
  match,
  saved,
  onOpen,
  onToggleList,
}: {
  item: MovieBoxCatalogItem;
  match?: Match;
  saved: boolean;
  onOpen: () => void;
  onToggleList: () => void;
}) {
  return (
    <article className="group relative w-[138px] shrink-0 sm:w-[154px] lg:w-[166px]">
      <button type="button" onClick={onOpen} className="tv-focus block w-full rounded-xl text-left">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/8 bg-elevated transition duration-200 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl">
          <CatalogPoster item={item} />

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <span className="flex size-11 items-center justify-center rounded-full bg-white text-black shadow-xl">
              {match ? <Play className="ml-0.5 size-4 fill-current" /> : <Info className="size-4" />}
            </span>
          </div>

          <span
            className={cn(
              "absolute left-2 top-2 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur",
              match
                ? "bg-emerald-400/90 text-black"
                : "border border-white/10 bg-black/55 text-white/70",
            )}
          >
            {match ? (match.item.type === "directory" ? "Series" : "Play") : "Catalog"}
          </span>
        </div>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-fg">{cleanDisplayTitle(item.title)}</p>
        <p className="mt-0.5 text-xs text-subtle">
          {match ? "Available in Pinflix" : item.kind === "series" ? "Series" : item.kind === "movie" ? "Movie" : "Discover"}
        </p>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleList();
        }}
        className={cn(
          "tv-focus absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border backdrop-blur transition",
          saved
            ? "border-brand/40 bg-brand text-white"
            : "border-white/10 bg-black/55 text-white/75 opacity-0 group-hover:opacity-100",
        )}
        aria-label={saved ? "Remove from My list" : "Add to My list"}
      >
        <Plus className={cn("size-4 transition-transform", saved && "rotate-45")} />
      </button>
    </article>
  );
}

function CinemaRow({
  row,
  matches,
  savedIds,
  onOpen,
  onToggleList,
}: {
  row: MovieBoxCatalogRow;
  matches: Map<string, Match>;
  savedIds: Set<string>;
  onOpen: (item: MovieBoxCatalogItem) => void;
  onToggleList: (item: MovieBoxCatalogItem) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!row.items.length) return null;

  function scroll(direction: number) {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.min(element.clientWidth * 0.86, 760),
      behavior: "smooth",
    });
  }

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] sm:text-xl">{row.title}</h2>
          <p className="mt-0.5 text-xs text-subtle">{row.items.length} titles</p>
        </div>
        <span className="text-xs text-muted">More</span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label={"Scroll " + row.title + " left"}
          className="tv-focus absolute left-2 top-[42%] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white backdrop-blur lg:flex lg:opacity-0 lg:group-hover/row:opacity-100"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div
          ref={scroller}
          className="hide-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 sm:gap-4 sm:px-6 lg:px-8"
        >
          {row.items.map((item) => (
            <CinemaCard
              key={item.id}
              item={item}
              match={matches.get(normalizeTitle(item.title))}
              saved={savedIds.has(item.id)}
              onOpen={() => onOpen(item)}
              onToggleList={() => onToggleList(item)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label={"Scroll " + row.title + " right"}
          className="tv-focus absolute right-2 top-[42%] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white backdrop-blur lg:flex lg:opacity-0 lg:group-hover/row:opacity-100"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </section>
  );
}

export function EntertainmentHub() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<MovieBoxCatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("home");
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<MovieBoxCatalogItem | null>(null);
  const [detail, setDetail] = useState<MovieBoxDetailPayload | null>(null);
  const [matches, setMatches] = useState<Map<string, Match>>(new Map());
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [bridgeTarget, setBridgeTarget] = useState<{ path: string; query: string } | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIST_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setSavedIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  const persistSaved = useCallback((next: Set<string>) => {
    setSavedIds(new Set(next));
    try {
      window.localStorage.setItem(LIST_KEY, JSON.stringify([...next]));
    } catch {
      // Local storage can be unavailable in restricted browsing modes.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);

    fetch("/api/catalog/moviebox", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        return response.json() as Promise<MovieBoxCatalogPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        const next = { ...payload, rows: fallbackRows(payload.rows ?? []) };
        setCatalog(next);
        const first = next.rows.flatMap((row) => row.items)[0] ?? null;
        setFeatured((current) => current ?? first);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog({
          source: "moviebox-public",
          fetchedAt: new Date().toISOString(),
          rows: fallbackRows([]),
        });
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connectBridge() {
      try {
        const sourceResponse = await fetch("/api/media/sources", { cache: "no-store" });
        if (!sourceResponse.ok) throw new Error("bridge unavailable");
        const sourcePayload = (await sourceResponse.json()) as { sources?: MediaSourceSummary[] };
        const cineplex = (sourcePayload.sources ?? []).find((source) => source.id === "cineplexbd");
        if (!cineplex) throw new Error("cineplex unavailable");

        const params = new URLSearchParams({ source: cineplex.id, path: "" });
        const browseResponse = await fetch("/api/media/browse?" + params.toString(), {
          cache: "no-store",
        });
        if (!browseResponse.ok) throw new Error("cineplex browse unavailable");
        const browse = (await browseResponse.json()) as MediaBrowsePayload;

        const next = new Map<string, Match>();
        for (const item of browse.items ?? []) {
          const key = normalizeTitle(item.name);
          if (!key || next.has(key)) continue;
          next.set(key, { item, source: cineplex.id });
        }

        if (cancelled) return;
        setMatches(next);
        setBridgeOnline(true);
      } catch {
        if (cancelled) return;
        setMatches(new Map());
        setBridgeOnline(false);
      }
    }

    void connectBridge();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!featured?.href) {
      setDetail(null);
      return;
    }

    const controller = new AbortController();
    setDetail(null);
    const params = new URLSearchParams({ href: featured.href });

    fetch("/api/catalog/moviebox/detail?" + params.toString(), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("detail unavailable");
        return response.json() as Promise<MovieBoxDetailPayload>;
      })
      .then((payload) => setDetail(payload))
      .catch(() => {});

    return () => controller.abort();
  }, [featured?.href]);

  const allRows = catalog?.rows ?? [];
  const allItems = useMemo(() => dedupeItems(allRows), [allRows]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle) {
      const items = allItems.filter((item) => item.title.toLowerCase().includes(needle)).slice(0, 60);
      return [
        {
          id: "search-results",
          title: "Search results",
          kind: "mixed" as const,
          items,
        },
      ];
    }

    if (filter === "list") {
      return [
        {
          id: "my-list",
          title: "My list",
          kind: "mixed" as const,
          items: allItems.filter((item) => savedIds.has(item.id)),
        },
      ];
    }

    return allRows.filter((row) => matchesFilter(row, filter));
  }, [allItems, allRows, filter, query, savedIds]);

  const featuredMatch = featured ? matches.get(normalizeTitle(featured.title)) : undefined;
  const heroImage = detail?.image ?? featured?.image ?? null;

  function toggleList(item: MovieBoxCatalogItem) {
    const next = new Set(savedIds);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    persistSaved(next);
  }

  function openItem(item: MovieBoxCatalogItem) {
    setFeatured(item);
    const match = matches.get(normalizeTitle(item.title));
    if (!match) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (match.item.type === "video") {
      const params = new URLSearchParams({
        source: match.source,
        path: match.item.path,
        title: cleanDisplayTitle(item.title),
      });
      router.push("/watch/media?" + params.toString());
      return;
    }

    setBridgeTarget({ path: match.item.path, query: "" });
    window.setTimeout(() => {
      document.getElementById("cineplexbd-library")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function heroAction() {
    if (!featured) return;
    if (featuredMatch) {
      openItem(featured);
      return;
    }
    setBridgeTarget({ path: "", query: cleanDisplayTitle(featured.title) });
    document.getElementById("cineplexbd-library")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh max-w-[1680px]">
        <aside className="sticky top-0 hidden h-dvh w-[224px] shrink-0 border-r border-border bg-[#08080a] lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-2.5 px-5">
            <LogoMark className="size-7" />
            <div>
              <p className="text-[15px] font-black tracking-[0.08em]">PINFLIX</p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-subtle">Entertainment</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {FILTERS.map((item) => {
              const Icon = item.icon;
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFilter(item.id);
                    setQuery("");
                  }}
                  className={cn(
                    "tv-focus flex h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium",
                    active
                      ? "bg-elevated text-brand"
                      : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2 text-xs">
              {bridgeOnline ? (
                <Wifi className="size-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="size-3.5 text-subtle" />
              )}
              <span className={bridgeOnline ? "text-emerald-300" : "text-subtle"}>
                {bridgeOnline ? "CineplexBD connected" : "CineplexBD bridge offline"}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-subtle">
              Public catalog metadata is separated from playback. Pinflix only plays configured sources.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <LogoMark className="size-7" />
                <span className="hidden text-sm font-black tracking-[0.08em] sm:inline">PINFLIX</span>
              </div>

              <div className="relative max-w-2xl flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search movies and TV shows"
                  aria-label="Search entertainment"
                  className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm outline-none transition placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setFilter("list");
                  setQuery("");
                }}
                className="tv-focus hidden h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white sm:flex"
              >
                <Bookmark className="size-4" />
                My list
              </button>
            </div>
          </div>

          <section className="relative isolate min-h-[620px] overflow-hidden border-b border-border sm:min-h-[680px]">
            {heroImage ? (
              <img
                key={heroImage}
                src={heroImage}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 -z-30 size-full object-cover object-center opacity-60"
              />
            ) : (
              <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_68%_25%,rgba(255,77,77,.28),transparent_26%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,.16),transparent_26%),linear-gradient(135deg,#08080a,#17171b_50%,#070708)]" />
            )}
            <div className="absolute inset-0 -z-20 bg-gradient-to-t from-bg via-bg/45 to-bg/15" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/58 to-transparent" />

            <div className="flex min-h-[620px] items-end px-4 pb-24 pt-20 sm:min-h-[680px] sm:px-6 lg:px-10 lg:pb-32">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  <Sparkles className="size-4" />
                  {featured?.section ?? "Pinflix Entertainment"}
                </div>

                <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                  {detail?.title ?? featured?.title ?? "Movies & Web Series"}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/68">
                  {detail?.rating ? <span className="font-semibold text-amber-200">★ {detail.rating.toFixed(1)}</span> : null}
                  {detail?.year ? <span>{detail.year}</span> : null}
                  {detail?.runtime ? <span>{detail.runtime}</span> : null}
                  {detail?.genres?.slice(0, 3).map((genre) => <span key={genre}>{genre}</span>)}
                  {featured ? <span>{featured.kind === "series" ? "Series" : featured.kind === "movie" ? "Movie" : "Entertainment"}</span> : null}
                </div>

                <p className="mt-4 max-w-xl text-sm leading-7 text-white/68 sm:text-base">
                  {detail?.description ||
                    "Discover titles from the public MovieBox catalog. Pinflix only enables playback when a title matches a configured CineplexBD or other authorized media source."}
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={heroAction}
                    className={cn(
                      "tv-focus inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold",
                      featuredMatch
                        ? "bg-white text-black hover:bg-white/90"
                        : "border border-white/15 bg-black/45 text-white hover:bg-black/65",
                    )}
                  >
                    {featuredMatch ? <Play className="size-4 fill-current" /> : <Search className="size-4" />}
                    {featuredMatch
                      ? featuredMatch.item.type === "directory"
                        ? "Browse episodes"
                        : "Play in Pinflix"
                      : "Find on CineplexBD"}
                  </button>

                  {featured ? (
                    <button
                      type="button"
                      onClick={() => toggleList(featured)}
                      className="tv-focus inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
                    >
                      <Plus className={cn("size-4", savedIds.has(featured.id) && "rotate-45")} />
                      {savedIds.has(featured.id) ? "In my list" : "My list"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs">
                  {featuredMatch ? (
                    <>
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <span className="text-emerald-300">Matched with CineplexBD</span>
                    </>
                  ) : (
                    <>
                      <span className="size-2 rounded-full bg-white/25" />
                      <span className="text-white/45">Catalog metadata only</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="relative z-10 -mt-16 space-y-10 pb-14">
            {catalogLoading ? (
              <div className="mx-4 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface/90 sm:mx-6 lg:mx-8">
                <div className="text-center text-sm text-muted">
                  <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
                  Building your cinema…
                </div>
              </div>
            ) : visibleRows.some((row) => row.items.length) ? (
              visibleRows.map((row) => (
                <CinemaRow
                  key={row.id}
                  row={row}
                  matches={matches}
                  savedIds={savedIds}
                  onOpen={openItem}
                  onToggleList={toggleList}
                />
              ))
            ) : (
              <div className="mx-4 rounded-2xl border border-dashed border-border bg-surface/70 px-6 py-16 text-center sm:mx-6 lg:mx-8">
                <Film className="mx-auto size-8 text-subtle" />
                <p className="mt-3 font-semibold">Nothing here yet</p>
                <p className="mt-1 text-sm text-muted">
                  {filter === "list" ? "Add titles to My list to see them here." : "Try another category or search."}
                </p>
              </div>
            )}

            <section id="cineplexbd-library" className="scroll-mt-24 px-4 pt-2 sm:px-6 lg:px-8">
              <MediaBrowser
                key={(bridgeTarget?.path ?? "") + "|" + (bridgeTarget?.query ?? "")}
                preferredSourceId="cineplexbd"
                sourceIds={["cineplexbd"]}
                initialPath={bridgeTarget?.path ?? ""}
                initialQuery={bridgeTarget?.query ?? ""}
                eyebrow="CineplexBD library"
                title="Playable movies & web series"
                description="This is the playback library. Titles above are public discovery metadata; only items available here are opened in the Pinflix player."
              />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

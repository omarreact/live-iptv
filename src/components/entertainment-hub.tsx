"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  Film,
  Flame,
  Home,
  Info,
  LoaderCircle,
  Moon,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { CineplexLibrary } from "@/components/cineplex-library";
import type {
  MovieBoxCatalogItem,
  MovieBoxCatalogPayload,
  MovieBoxCatalogRow,
  MovieBoxDetailPayload,
} from "@/lib/moviebox/types";
import { cn } from "@/lib/utils";

type FilterId = "home" | "shows" | "movies" | "animation" | "trending" | "midnight" | "list";

type BrowseSort = "featured" | "latest" | "rating" | "az";
type BrowseKind = "all" | "movie" | "series";
type BrowseYear =
  | "all"
  | "2026"
  | "2025"
  | "2024"
  | "2023"
  | "2022"
  | "2021"
  | "2020"
  | "2010s"
  | "2000s"
  | "1990s"
  | "1980s";

type FilteredResult = {
  item: MovieBoxCatalogItem;
  detail: MovieBoxDetailPayload | null;
  sourceIndex: number;
};

const YEAR_OPTIONS: Array<{ value: BrowseYear; label: string }> = [
  { value: "all", label: "All years" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
  { value: "2021", label: "2021" },
  { value: "2020", label: "2020" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "1990s", label: "1990s" },
  { value: "1980s", label: "1980s" },
];

const GENRE_OPTIONS = [
  "all",
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Drama",
  "Fantasy",
  "Horror",
  "Romance",
  "Sci-Fi",
  "Thriller",
] as const;

const COUNTRY_OPTIONS = [
  "all",
  "United States",
  "United Kingdom",
  "India",
  "Korea",
  "Japan",
  "Bangladesh",
  "China",
] as const;

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

function cleanDisplayTitle(value: string): string {
  return value
    .replace(/^Limited Free\s+/i, "")
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
  if (filter === "trending") return text.includes("trending") || text.includes("recent") || text.includes("top");
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
      { rootMargin: "900px 0px" },
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
          <p className="line-clamp-4 text-sm font-semibold leading-snug text-white/85">
            {cleanDisplayTitle(item.title)}
          </p>
        </div>
      )}
    </div>
  );
}

function CinemaCard({
  item,
  saved,
  onOpen,
  onToggleList,
}: {
  item: MovieBoxCatalogItem;
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
              <Info className="size-4" />
            </span>
          </div>

          <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">
            MovieBox
          </span>
        </div>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-fg">{cleanDisplayTitle(item.title)}</p>
        <p className="mt-0.5 text-xs text-subtle">
          {item.kind === "series" ? "Series" : item.kind === "movie" ? "Movie" : "Discover"}
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

function FilteredCard({
  result,
  saved,
  onOpen,
  onToggleList,
}: {
  result: FilteredResult;
  saved: boolean;
  onOpen: () => void;
  onToggleList: () => void;
}) {
  const { item, detail } = result;
  const image = detail?.image ?? item.image;

  return (
    <article className="group relative min-w-0">
      <button type="button" onClick={onOpen} className="tv-focus block w-full rounded-xl text-left">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/8 bg-elevated transition duration-200 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="size-full object-cover transition duration-300 group-hover:scale-[1.035]"
            />
          ) : (
            <CatalogPoster item={item} />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
          <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/75 backdrop-blur">
            {item.kind === "series" ? "Series" : "Movie"}
          </div>
          {detail?.rating ? (
            <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-amber-200 backdrop-blur">
              ★ {detail.rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-fg">{cleanDisplayTitle(item.title)}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-subtle">
          {detail?.year ?? (item.kind === "series" ? "Series" : "Movie")}
          {detail?.genres?.[0] ? " • " + detail.genres[0] : ""}
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
  savedIds,
  onOpen,
  onToggleList,
}: {
  row: MovieBoxCatalogRow;
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
        <span className="text-xs text-muted">MovieBox catalog</span>
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
  const [catalog, setCatalog] = useState<MovieBoxCatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("home");
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<MovieBoxCatalogItem | null>(null);
  const [detail, setDetail] = useState<MovieBoxDetailPayload | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [browseKind, setBrowseKind] = useState<BrowseKind>("all");
  const [browseYear, setBrowseYear] = useState<BrowseYear>("all");
  const [browseGenre, setBrowseGenre] = useState<(typeof GENRE_OPTIONS)[number]>("all");
  const [browseCountry, setBrowseCountry] = useState<(typeof COUNTRY_OPTIONS)[number]>("all");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("featured");
  const [filteredResults, setFilteredResults] = useState<FilteredResult[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

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

  const advancedFiltersActive =
    browseKind !== "all" ||
    browseYear !== "all" ||
    browseGenre !== "all" ||
    browseCountry !== "all" ||
    browseSort !== "featured";

  useEffect(() => {
    if (!advancedFiltersActive) {
      setFilteredResults([]);
      setFilterLoading(false);
      setFilterError(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      kind: browseKind,
      year: browseYear,
      genre: browseGenre,
      country: browseCountry,
      sort: browseSort,
    });

    if (query.trim()) params.set("q", query.trim());

    setFilterLoading(true);
    setFilterError(null);

    fetch("/api/catalog/moviebox/filter?" + params.toString(), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Filtered catalog unavailable");
        return response.json() as Promise<{ items?: FilteredResult[] }>;
      })
      .then((payload) => setFilteredResults(payload.items ?? []))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFilteredResults([]);
        setFilterError(error instanceof Error ? error.message : "Filtered catalog unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilterLoading(false);
      });

    return () => controller.abort();
  }, [
    advancedFiltersActive,
    browseCountry,
    browseGenre,
    browseKind,
    browseSort,
    browseYear,
    query,
  ]);

  const allRows = catalog?.rows ?? [];
  const allItems = useMemo(() => dedupeItems(allRows), [allRows]);
  const catalogOnline = allItems.length > 0;

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle) {
      const items = allItems
        .filter((item) => cleanDisplayTitle(item.title).toLowerCase().includes(needle))
        .slice(0, 60);
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

  const heroImage = detail?.image ?? featured?.image ?? null;

  function toggleList(item: MovieBoxCatalogItem) {
    const next = new Set(savedIds);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    persistSaved(next);
  }

  function openItem(item: MovieBoxCatalogItem) {
    setFeatured(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearAdvancedFilters() {
    setBrowseKind("all");
    setBrowseYear("all");
    setBrowseGenre("all");
    setBrowseCountry("all");
    setBrowseSort("featured");
  }

  function browseCatalog() {
    document.getElementById("moviebox-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
                    active ? "bg-elevated text-brand" : "text-muted hover:bg-surface hover:text-fg",
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
              <span className={cn("size-2 rounded-full", catalogOnline ? "bg-emerald-400" : "bg-white/20")} />
              <span className={catalogOnline ? "text-emerald-300" : "text-subtle"}>
                {catalogOnline ? "MovieBox catalog live" : "MovieBox catalog unavailable"}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-subtle">
              MovieBox supplies catalog metadata. Full-length playback is not proxied by Pinflix.
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
                  placeholder="Search the MovieBox catalog"
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
                  {featured?.section ?? "MovieBox discovery"}
                </div>

                <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                  {detail?.title ?? (featured ? cleanDisplayTitle(featured.title) : "Movies & Web Series")}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/68">
                  {detail?.rating ? <span className="font-semibold text-amber-200">★ {detail.rating.toFixed(1)}</span> : null}
                  {detail?.year ? <span>{detail.year}</span> : null}
                  {detail?.runtime ? <span>{detail.runtime}</span> : null}
                  {detail?.genres?.slice(0, 3).map((genre) => <span key={genre}>{genre}</span>)}
                  {featured ? (
                    <span>{featured.kind === "series" ? "Series" : featured.kind === "movie" ? "Movie" : "Entertainment"}</span>
                  ) : null}
                </div>

                <p className="mt-4 max-w-xl text-sm leading-7 text-white/68 sm:text-base">
                  {detail?.description ||
                    "Browse movies, TV shows, animation and trending titles from the public MovieBox catalog inside Pinflix."}
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={browseCatalog}
                    className="tv-focus inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
                  >
                    <Film className="size-4" />
                    Browse catalog
                  </button>

                  {featured ? (
                    <a
                      href={featured.href}
                      target="_blank"
                      rel="noreferrer"
                      className="tv-focus inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
                    >
                      <ExternalLink className="size-4" />
                      Open on MovieBox
                    </a>
                  ) : null}

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

                <div className="mt-5 flex items-center gap-2 text-xs text-white/45">
                  <span className={cn("size-2 rounded-full", catalogOnline ? "bg-emerald-400" : "bg-white/25")} />
                  <span>{catalogOnline ? "MovieBox metadata connected — playback opens at the source" : "MovieBox discovery source unavailable"}</span>
                </div>
              </div>
            </div>
          </section>

          <CineplexLibrary />

          <div id="moviebox-catalog" className="relative z-10 pb-14">
            <div className="sticky top-[68px] z-20 mx-4 mb-8 rounded-2xl border border-border bg-bg/95 p-3 shadow-2xl backdrop-blur-xl sm:mx-6 lg:mx-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-brand" />
                  <span className="text-sm font-semibold">Filter & sort</span>
                  {filterLoading ? <LoaderCircle className="size-3.5 animate-spin text-brand" /> : null}
                </div>

                {advancedFiltersActive ? (
                  <button
                    type="button"
                    onClick={clearAdvancedFilters}
                    className="tv-focus inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted hover:bg-surface hover:text-fg"
                  >
                    <X className="size-3.5" />
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <select
                  value={browseKind}
                  onChange={(event) => setBrowseKind(event.target.value as BrowseKind)}
                  aria-label="Content type"
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                >
                  <option value="all">All types</option>
                  <option value="movie">Movies</option>
                  <option value="series">TV series</option>
                </select>

                <select
                  value={browseYear}
                  onChange={(event) => setBrowseYear(event.target.value as BrowseYear)}
                  aria-label="Year"
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                >
                  {YEAR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={browseGenre}
                  onChange={(event) =>
                    setBrowseGenre(event.target.value as (typeof GENRE_OPTIONS)[number])
                  }
                  aria-label="Genre"
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                >
                  {GENRE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All genres" : option}
                    </option>
                  ))}
                </select>

                <select
                  value={browseCountry}
                  onChange={(event) =>
                    setBrowseCountry(event.target.value as (typeof COUNTRY_OPTIONS)[number])
                  }
                  aria-label="Country"
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All countries" : option}
                    </option>
                  ))}
                </select>

                <select
                  value={browseSort}
                  onChange={(event) => setBrowseSort(event.target.value as BrowseSort)}
                  aria-label="Sort by"
                  className="col-span-2 h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand sm:col-span-1"
                >
                  <option value="featured">For You</option>
                  <option value="latest">Latest</option>
                  <option value="rating">Highest rating</option>
                  <option value="az">A–Z</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
                {browseYear !== "all" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1.5">
                    <CalendarDays className="size-3.5" />
                    {browseYear}
                  </span>
                ) : null}
                {browseSort === "latest" ? (
                  <span className="rounded-full bg-brand/10 px-2.5 py-1.5 text-brand">Newest first</span>
                ) : null}
                {advancedFiltersActive && !filterLoading ? (
                  <span className="rounded-full bg-surface px-2.5 py-1.5">
                    {filteredResults.length} matches
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-10">
            {advancedFiltersActive ? (
              filterLoading ? (
                <div className="mx-4 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface/90 sm:mx-6 lg:mx-8">
                  <div className="text-center text-sm text-muted">
                    <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
                    Applying filters…
                  </div>
                </div>
              ) : filterError ? (
                <div className="mx-4 rounded-2xl border border-border bg-surface/80 px-6 py-12 text-center sm:mx-6 lg:mx-8">
                  <p className="font-semibold">Could not load filtered catalog</p>
                  <p className="mt-1 text-sm text-muted">{filterError}</p>
                </div>
              ) : filteredResults.length ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-7 px-4 sm:grid-cols-3 sm:px-6 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:px-8">
                  {filteredResults.map((result) => (
                    <FilteredCard
                      key={result.item.id}
                      result={result}
                      saved={savedIds.has(result.item.id)}
                      onOpen={() => openItem(result.item)}
                      onToggleList={() => toggleList(result.item)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mx-4 rounded-2xl border border-dashed border-border bg-surface/70 px-6 py-16 text-center sm:mx-6 lg:mx-8">
                  <Film className="mx-auto size-8 text-subtle" />
                  <p className="mt-3 font-semibold">No matching titles</p>
                  <p className="mt-1 text-sm text-muted">Try another year, genre, country, or type.</p>
                </div>
              )
            ) : catalogLoading ? (
              <div className="mx-4 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface/90 sm:mx-6 lg:mx-8">
                <div className="text-center text-sm text-muted">
                  <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
                  Loading MovieBox catalog…
                </div>
              </div>
            ) : visibleRows.some((row) => row.items.length) ? (
              visibleRows.map((row) => (
                <CinemaRow
                  key={row.id}
                  row={row}
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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

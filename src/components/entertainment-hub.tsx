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
  Star,
  Tv,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import type {
  MovieBoxCatalogItem,
  MovieBoxCatalogPayload,
  MovieBoxCatalogRow,
  MovieBoxDetailPayload,
} from "@/lib/moviebox/types";
import { cn } from "@/lib/utils";

type FilterId = "home" | "shows" | "movies" | "animation" | "trending" | "midnight" | "list";
type SortMode = "featured" | "latest" | "rating" | "az";
type KindFilter = "all" | "movie" | "series";
type YearFilter = "all" | "2026" | "2025" | "2024" | "2023" | "2022" | "2021" | "2020" | "2010s" | "2000s" | "1990s" | "1980s";

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

const YEAR_OPTIONS: Array<{ value: YearFilter; label: string }> = [
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
  "Comedies",
  "Adventure",
  "Horror & Thriller",
  "Animation Movies",
  "Anime",
  "Marvel Movies",
  "DC Movies",
  "K-Drama",
  "C-Drama",
  "Fantasy Series",
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

const LIST_KEY = "pinflix:entertainment:list";
const DETAIL_CACHE = new Map<string, MovieBoxDetailPayload>();
const DETAIL_REQUESTS = new Map<string, Promise<MovieBoxDetailPayload>>();

function cleanDisplayTitle(value: string): string {
  return value
    .replace(/^Limited Free\s+/i, "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/^\d(?:\.\d)?\s+(?:19|20)\d{2}\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadDetail(href: string): Promise<MovieBoxDetailPayload> {
  const cached = DETAIL_CACHE.get(href);
  if (cached) return cached;

  const inflight = DETAIL_REQUESTS.get(href);
  if (inflight) return inflight;

  const params = new URLSearchParams({ href });
  const request = fetch("/api/catalog/moviebox/detail?" + params.toString(), {
    cache: "force-cache",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("MovieBox metadata unavailable");
      return response.json() as Promise<MovieBoxDetailPayload>;
    })
    .then((detail) => {
      DETAIL_CACHE.set(href, detail);
      DETAIL_REQUESTS.delete(href);
      return detail;
    })
    .catch((error) => {
      DETAIL_REQUESTS.delete(href);
      throw error;
    });

  DETAIL_REQUESTS.set(href, request);
  return request;
}

function matchesNavigation(row: MovieBoxCatalogRow, filter: FilterId): boolean {
  const text = (row.title + " " + row.kind).toLowerCase();
  if (filter === "home" || filter === "list") return true;
  if (filter === "shows") return row.kind === "series" || text.includes("drama") || text.includes("tv");
  if (filter === "movies") return row.kind === "movie" || text.includes("movie");
  if (filter === "animation") return text.includes("anime") || text.includes("animated") || text.includes("animation");
  if (filter === "trending") return text.includes("trending") || text.includes("top");
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

function yearMatches(year: string | null | undefined, filter: YearFilter): boolean {
  if (filter === "all") return true;
  if (!year) return false;
  const numeric = Number.parseInt(year, 10);
  if (!Number.isFinite(numeric)) return false;
  if (/^\d{4}$/.test(filter)) return numeric === Number.parseInt(filter, 10);
  if (filter === "2010s") return numeric >= 2010 && numeric <= 2019;
  if (filter === "2000s") return numeric >= 2000 && numeric <= 2009;
  if (filter === "1990s") return numeric >= 1990 && numeric <= 1999;
  if (filter === "1980s") return numeric >= 1980 && numeric <= 1989;
  return true;
}

function CatalogPoster({
  item,
  detail,
  priority = false,
  onDetail,
}: {
  item: MovieBoxCatalogItem;
  detail?: MovieBoxDetailPayload;
  priority?: boolean;
  onDetail: (href: string, detail: MovieBoxDetailPayload) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(() => item.image ?? detail?.image ?? DETAIL_CACHE.get(item.href)?.image ?? null);
  const [ready, setReady] = useState(Boolean(image));

  useEffect(() => {
    const known = item.image ?? detail?.image ?? DETAIL_CACHE.get(item.href)?.image ?? null;
    if (known) {
      setImage(known);
      setReady(true);
      return;
    }

    const node = wrapRef.current;
    if (!node) return;

    let cancelled = false;
    const fetchPoster = () => {
      void loadDetail(item.href)
        .then((payload) => {
          if (cancelled) return;
          setImage(payload.image || null);
          onDetail(item.href, payload);
        })
        .catch(() => {});
    };

    if (priority) {
      fetchPoster();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        fetchPoster();
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [detail?.image, item.href, item.image, onDetail, priority]);

  return (
    <div ref={wrapRef} className="size-full">
      {image ? (
        <img
          src={image}
          alt=""
          loading={priority ? "eager" : "lazy"}
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
  detail,
  saved,
  fluid = false,
  priority = false,
  onOpen,
  onToggleList,
  onDetail,
}: {
  item: MovieBoxCatalogItem;
  detail?: MovieBoxDetailPayload;
  saved: boolean;
  fluid?: boolean;
  priority?: boolean;
  onOpen: () => void;
  onToggleList: () => void;
  onDetail: (href: string, detail: MovieBoxDetailPayload) => void;
}) {
  return (
    <article className={cn("group relative shrink-0", fluid ? "w-full" : "w-[138px] sm:w-[154px] lg:w-[166px]")}>
      <button type="button" onClick={onOpen} className="tv-focus block w-full rounded-xl text-left">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/8 bg-elevated transition duration-200 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl">
          <CatalogPoster item={item} detail={detail} priority={priority} onDetail={onDetail} />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <span className="flex size-11 items-center justify-center rounded-full bg-white text-black shadow-xl">
              <Info className="size-4" />
            </span>
          </div>

          <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">
            {item.kind === "series" ? "Series" : "Movie"}
          </span>

          {detail?.rating ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-amber-200 backdrop-blur">
              <Star className="size-3 fill-current" />
              {detail.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-fg">{cleanDisplayTitle(item.title)}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-subtle">
          <span>{detail?.year ?? (item.kind === "series" ? "Series" : "Movie")}</span>
          {detail?.genres?.[0] ? <span>• {detail.genres[0]}</span> : null}
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
  metadata,
  savedIds,
  rowIndex,
  onOpen,
  onToggleList,
  onDetail,
}: {
  row: MovieBoxCatalogRow;
  metadata: Map<string, MovieBoxDetailPayload>;
  savedIds: Set<string>;
  rowIndex: number;
  onOpen: (item: MovieBoxCatalogItem) => void;
  onToggleList: (item: MovieBoxCatalogItem) => void;
  onDetail: (href: string, detail: MovieBoxDetailPayload) => void;
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
          {row.items.map((item, itemIndex) => (
            <CinemaCard
              key={item.id}
              item={item}
              detail={metadata.get(item.href)}
              saved={savedIds.has(item.id)}
              priority={rowIndex === 0 && itemIndex < 8}
              onOpen={() => onOpen(item)}
              onToggleList={() => onToggleList(item)}
              onDetail={onDetail}
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
  const [metadata, setMetadata] = useState<Map<string, MovieBoxDetailPayload>>(new Map());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [yearFilter, setYearFilter] = useState<YearFilter>("all");
  const [genreFilter, setGenreFilter] = useState<(typeof GENRE_OPTIONS)[number]>("all");
  const [countryFilter, setCountryFilter] = useState<(typeof COUNTRY_OPTIONS)[number]>("all");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIST_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setSavedIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  const rememberDetail = useCallback((href: string, payload: MovieBoxDetailPayload) => {
    DETAIL_CACHE.set(href, payload);
    setMetadata((current) => {
      if (current.get(href) === payload) return current;
      const next = new Map(current);
      next.set(href, payload);
      return next;
    });
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

    let cancelled = false;
    setDetail(null);

    void loadDetail(featured.href)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload);
        rememberDetail(featured.href, payload);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [featured?.href, rememberDetail]);

  const allRows = catalog?.rows ?? [];
  const allItems = useMemo(() => dedupeItems(allRows), [allRows]);
  const catalogOnline = allItems.length > 0;

  const selectedRows = useMemo(() => {
    let rows = allRows.filter((row) => matchesNavigation(row, filter));

    if (genreFilter !== "all") {
      const needle = genreFilter.toLowerCase();
      rows = rows.filter((row) => {
        const title = row.title.toLowerCase();
        if (needle === "comedies") return title.includes("comed");
        return title.includes(needle.toLowerCase());
      });
    }

    return rows;
  }, [allRows, filter, genreFilter]);

  const candidateItems = useMemo(() => {
    let items = dedupeItems(selectedRows);

    if (filter === "list") {
      items = items.filter((item) => savedIds.has(item.id));
    }

    if (kindFilter !== "all") {
      items = items.filter((item) => item.kind === kindFilter);
    }

    const needle = query.trim().toLowerCase();
    if (needle) {
      items = items.filter((item) => cleanDisplayTitle(item.title).toLowerCase().includes(needle));
    }

    return items;
  }, [filter, kindFilter, query, savedIds, selectedRows]);

  const needsMetadata =
    yearFilter !== "all" ||
    countryFilter !== "all" ||
    sortMode === "latest" ||
    sortMode === "rating";

  useEffect(() => {
    if (!needsMetadata || !candidateItems.length) return;

    let cancelled = false;
    let cursor = 0;
    const targets = candidateItems
      .filter((item) => !metadata.has(item.href) && !DETAIL_CACHE.has(item.href))
      .slice(0, 120);

    async function worker() {
      while (!cancelled) {
        const item = targets[cursor++];
        if (!item) return;
        try {
          const payload = await loadDetail(item.href);
          if (cancelled) return;
          rememberDetail(item.href, payload);
        } catch {
          // Individual missing metadata should not block the catalog.
        }
      }
    }

    const workerCount = Math.min(6, targets.length);
    void Promise.all(Array.from({ length: workerCount }, () => worker()));

    return () => {
      cancelled = true;
    };
  }, [candidateItems, metadata, needsMetadata, rememberDetail]);

  const filteredItems = useMemo(() => {
    let items = [...candidateItems];

    if (yearFilter !== "all") {
      items = items.filter((item) => yearMatches(metadata.get(item.href)?.year, yearFilter));
    }

    if (countryFilter !== "all") {
      items = items.filter((item) => metadata.get(item.href)?.country === countryFilter);
    }

    if (sortMode === "latest") {
      items.sort((a, b) => {
        const ay = Number.parseInt(metadata.get(a.href)?.year ?? "0", 10);
        const by = Number.parseInt(metadata.get(b.href)?.year ?? "0", 10);
        return by - ay;
      });
    } else if (sortMode === "rating") {
      items.sort((a, b) => (metadata.get(b.href)?.rating ?? -1) - (metadata.get(a.href)?.rating ?? -1));
    } else if (sortMode === "az") {
      items.sort((a, b) => cleanDisplayTitle(a.title).localeCompare(cleanDisplayTitle(b.title)));
    }

    return items;
  }, [candidateItems, countryFilter, metadata, sortMode, yearFilter]);

  const metadataReady = candidateItems.filter(
    (item) => metadata.has(item.href) || DETAIL_CACHE.has(item.href),
  ).length;
  const metadataLoading = needsMetadata && metadataReady < Math.min(candidateItems.length, 120);

  const toolbarActive =
    sortMode !== "featured" ||
    kindFilter !== "all" ||
    yearFilter !== "all" ||
    genreFilter !== "all" ||
    countryFilter !== "all";

  const gridMode = toolbarActive || Boolean(query.trim()) || filter === "list";
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

  function clearToolbar() {
    setSortMode("featured");
    setKindFilter("all");
    setYearFilter("all");
    setGenreFilter("all");
    setCountryFilter("all");
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
              Browse and filter public MovieBox catalog metadata. Full-length playback is not proxied by Pinflix.
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

          <section className="relative isolate min-h-[560px] overflow-hidden border-b border-border sm:min-h-[620px]">
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

            <div className="flex min-h-[560px] items-end px-4 pb-20 pt-20 sm:min-h-[620px] sm:px-6 lg:px-10 lg:pb-24">
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
                  {detail?.country ? <span>{detail.country}</span> : null}
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
                    <SlidersHorizontal className="size-4" />
                    Browse & filter
                  </button>

                  {featured ? (
                    <a
                      href={featured.href}
                      target="_blank"
                      rel="noreferrer"
                      className="tv-focus inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
                    >
                      <ExternalLink className="size-4" />
                      Open source page
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
                  <span>
                    {catalogOnline
                      ? "MovieBox metadata connected — playback opens at the source"
                      : "MovieBox discovery source unavailable"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div id="moviebox-catalog" className="relative z-10 -mt-8 pb-14">
            <div className="sticky top-[68px] z-20 mx-4 mb-8 rounded-2xl border border-border bg-bg/95 p-3 shadow-2xl backdrop-blur-xl sm:mx-6 lg:mx-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-brand" />
                  <span className="text-sm font-semibold">Filters</span>
                  {metadataLoading ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
                      <LoaderCircle className="size-3 animate-spin" />
                      Loading metadata {metadataReady}/{Math.min(candidateItems.length, 120)}
                    </span>
                  ) : null}
                </div>

                {toolbarActive ? (
                  <button
                    type="button"
                    onClick={clearToolbar}
                    className="tv-focus inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted hover:bg-surface hover:text-fg"
                  >
                    <X className="size-3.5" />
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <label className="relative">
                  <span className="sr-only">Content type</span>
                  <select
                    value={kindFilter}
                    onChange={(event) => setKindFilter(event.target.value as KindFilter)}
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                  >
                    <option value="all">All types</option>
                    <option value="movie">Movies</option>
                    <option value="series">TV series</option>
                  </select>
                </label>

                <label className="relative">
                  <span className="sr-only">Year</span>
                  <select
                    value={yearFilter}
                    onChange={(event) => setYearFilter(event.target.value as YearFilter)}
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                  >
                    {YEAR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="relative">
                  <span className="sr-only">Genre</span>
                  <select
                    value={genreFilter}
                    onChange={(event) =>
                      setGenreFilter(event.target.value as (typeof GENRE_OPTIONS)[number])
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                  >
                    {GENRE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All genres" : option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="relative">
                  <span className="sr-only">Country</span>
                  <select
                    value={countryFilter}
                    onChange={(event) =>
                      setCountryFilter(event.target.value as (typeof COUNTRY_OPTIONS)[number])
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                  >
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All countries" : option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="relative col-span-2 sm:col-span-1">
                  <span className="sr-only">Sort by</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
                  >
                    <option value="featured">For You</option>
                    <option value="latest">Latest</option>
                    <option value="rating">Highest rating</option>
                    <option value="az">A–Z</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1.5">
                  <Film className="size-3.5" />
                  {gridMode ? filteredItems.length : candidateItems.length} titles
                </span>
                {yearFilter !== "all" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1.5">
                    <CalendarDays className="size-3.5" />
                    {yearFilter}
                  </span>
                ) : null}
                {sortMode === "latest" ? (
                  <span className="rounded-full bg-brand/10 px-2.5 py-1.5 text-brand">Newest first</span>
                ) : null}
              </div>
            </div>

            {catalogLoading ? (
              <div className="mx-4 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface/90 sm:mx-6 lg:mx-8">
                <div className="text-center text-sm text-muted">
                  <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
                  Loading MovieBox catalog…
                </div>
              </div>
            ) : gridMode ? (
              filteredItems.length ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-7 px-4 sm:grid-cols-3 sm:px-6 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:px-8">
                  {filteredItems.map((item, index) => (
                    <CinemaCard
                      key={item.id}
                      item={item}
                      detail={metadata.get(item.href)}
                      saved={savedIds.has(item.id)}
                      fluid
                      priority={index < 10}
                      onOpen={() => openItem(item)}
                      onToggleList={() => toggleList(item)}
                      onDetail={rememberDetail}
                    />
                  ))}
                </div>
              ) : metadataLoading ? (
                <div className="mx-4 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface/70 sm:mx-6 lg:mx-8">
                  <div className="text-center text-sm text-muted">
                    <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
                    Applying year and metadata filters…
                  </div>
                </div>
              ) : (
                <div className="mx-4 rounded-2xl border border-dashed border-border bg-surface/70 px-6 py-16 text-center sm:mx-6 lg:mx-8">
                  <Film className="mx-auto size-8 text-subtle" />
                  <p className="mt-3 font-semibold">No matching titles</p>
                  <p className="mt-1 text-sm text-muted">Change the year, genre, country, type, or sort filters.</p>
                </div>
              )
            ) : selectedRows.some((row) => row.items.length) ? (
              <div className="space-y-10">
                {selectedRows.map((row, rowIndex) => (
                  <CinemaRow
                    key={row.id}
                    row={row}
                    rowIndex={rowIndex}
                    metadata={metadata}
                    savedIds={savedIds}
                    onOpen={openItem}
                    onToggleList={toggleList}
                    onDetail={rememberDetail}
                  />
                ))}
              </div>
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
    </main>
  );
}

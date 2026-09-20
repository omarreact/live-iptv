"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Clapperboard,
  ExternalLink,
  Film,
  Globe2,
  LoaderCircle,
  Search,
  Server,
  Sparkles,
  Tv,
  Wifi,
} from "lucide-react";
import type {
  MediaBrowsePayload,
  MediaItem,
  MediaSearchPayload,
  MediaSourceSummary,
} from "@/lib/media/types";
import { cn } from "@/lib/utils";

type BridgeState = "loading" | "online" | "offline";
type TypeFilter = "all" | "movie" | "series";

const SOURCE_ID = "cineplexbd";
const CINEPLEX_HOME = "http://cineplexbd.net/index.php";

function cineplexSearchUrl(query: string): string {
  const q = query.trim();
  return q
    ? `http://cineplexbd.net/search.php?q=${encodeURIComponent(q)}`
    : CINEPLEX_HOME;
}

function cardType(item: MediaItem): "movie" | "series" {
  if (item.mediaType === "series" || item.type === "directory") return "series";
  return "movie";
}

function providerHref(item: MediaItem): string {
  if (item.providerUrl) return item.providerUrl;
  const type = cardType(item);
  const rawId = item.path.match(/[?&]id=(\d+)/)?.[1] || item.path.match(/\d+/)?.[0] || item.path;
  return type === "series"
    ? `http://cineplexbd.net/tview.php?id=${encodeURIComponent(rawId)}`
    : `http://cineplexbd.net/view.php?id=${encodeURIComponent(rawId)}`;
}

function openExternal(url: string) {
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (tab) tab.opener = null;
}

function CineplexCard({ item }: { item: MediaItem }) {
  const type = cardType(item);
  const href = providerHref(item);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="tv-focus group block min-w-0 rounded-2xl text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-elevated shadow-lg transition duration-200 group-hover:-translate-y-1 group-hover:border-brand/40 group-hover:shadow-2xl">
        {item.poster ? (
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="pinflix-shimmer flex size-full items-center justify-center">
            {type === "series" ? (
              <Tv className="size-10 text-white/25" />
            ) : (
              <Clapperboard className="size-10 text-white/25" />
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/10" />

        <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/80 backdrop-blur">
          {type === "series" ? "Series" : "Movie"}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
            <ExternalLink className="size-5" />
          </span>
        </div>

        {item.year ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white/75 backdrop-blur">
            {item.year}
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-5 text-fg">{item.name}</p>
      <p className="mt-1 line-clamp-1 text-xs text-subtle">
        {item.category || (type === "series" ? "CineplexBD Series" : "CineplexBD Movie")}
      </p>
    </a>
  );
}

export function CineplexLibrary() {
  const [bridgeState, setBridgeState] = useState<BridgeState>("loading");
  const [source, setSource] = useState<MediaSourceSummary | null>(null);
  const [initialItems, setInitialItems] = useState<MediaItem[]>([]);
  const [searchItems, setSearchItems] = useState<MediaItem[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setBridgeState("loading");
    setBridgeError(null);

    fetch("/api/media/sources", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          sources?: MediaSourceSummary[];
          code?: string;
        };
        if (!response.ok) {
          throw new Error(
            payload.code === "BRIDGE_NOT_CONFIGURED"
              ? "Optional Pinflix bridge is not configured."
              : "Optional Pinflix bridge is currently unreachable.",
          );
        }
        const found = (payload.sources ?? []).find((item) => item.id === SOURCE_ID);
        if (!found) throw new Error("CineplexBD is not configured on the optional bridge.");
        return found;
      })
      .then(async (found) => {
        setSource(found);
        const params = new URLSearchParams({ source: SOURCE_ID, path: "" });
        const response = await fetch("/api/media/browse?" + params.toString(), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("CineplexBD bridge catalog is currently unavailable.");
        const payload = (await response.json()) as MediaBrowsePayload;
        setInitialItems(payload.items ?? []);
        setBridgeState("online");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setBridgeState("offline");
        setSource(null);
        setInitialItems([]);
        setBridgeError(reason instanceof Error ? reason.message : "Optional bridge unavailable.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!query || bridgeState !== "online") {
      setSearchItems([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const params = new URLSearchParams({
      source: SOURCE_ID,
      q: query,
      limit: "36",
    });

    fetch("/api/media/search?" + params.toString(), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("CineplexBD bridge search is unavailable.");
        return response.json() as Promise<MediaSearchPayload>;
      })
      .then((payload) => {
        setSearchItems(payload.items ?? []);
        setBridgeError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setSearchItems([]);
        setBridgeError(reason instanceof Error ? reason.message : "CineplexBD bridge search failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => controller.abort();
  }, [bridgeState, query]);

  const items = query && bridgeState === "online" ? searchItems : initialItems;
  const filtered = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((item) => cardType(item) === typeFilter);
  }, [items, typeFilter]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();

    if (bridgeState === "online") {
      setQuery(next);
      return;
    }

    openExternal(cineplexSearchUrl(next));
  }

  function directSearch() {
    openExternal(cineplexSearchUrl(input));
  }

  return (
    <section className="relative overflow-hidden border-y border-border bg-[linear-gradient(180deg,rgba(229,9,20,.07),transparent_48%)] py-9 sm:py-11">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-brand">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">CineplexBD provider</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              Browser Direct + optional Pinflix catalog
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              CineplexBD opens directly through your own browser and ISP connection. When the optional
              Pinflix bridge is online, the same section also shows searchable CineplexBD catalog cards
              inside Pinflix.
            </p>
          </div>

          <form onSubmit={submit} className="relative w-full xl:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                bridgeState === "online"
                  ? "Search CineplexBD inside Pinflix"
                  : "Search CineplexBD in your browser"
              }
              aria-label="Search CineplexBD"
              className="h-11 w-full rounded-xl border border-border bg-bg/70 pl-10 pr-24 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            <button
              type="submit"
              className="tv-focus absolute right-1.5 top-1.5 h-8 rounded-lg bg-white px-3 text-xs font-semibold text-black"
            >
              Search
            </button>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
          <a
            href={CINEPLEX_HOME}
            target="_blank"
            rel="noreferrer"
            className="tv-focus inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/8 px-2.5 py-1.5 text-emerald-200"
          >
            <Globe2 className="size-3.5" />
            Browser Direct
            <ExternalLink className="size-3" />
          </a>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <Server className="size-3.5" />
            CineplexBD
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <Wifi
              className={cn(
                "size-3.5",
                bridgeState === "online"
                  ? "text-emerald-300"
                  : bridgeState === "loading"
                    ? "text-amber-300"
                    : "text-subtle",
              )}
            />
            {bridgeState === "online"
              ? "Catalog bridge connected"
              : bridgeState === "loading"
                ? "Checking optional bridge"
                : "Browser Direct active"}
          </span>

          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={cn(
              "tv-focus rounded-full border px-2.5 py-1.5",
              typeFilter === "all" ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-bg/60",
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("movie")}
            className={cn(
              "tv-focus inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5",
              typeFilter === "movie" ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-bg/60",
            )}
          >
            <Film className="size-3.5" />
            Movies
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("series")}
            className={cn(
              "tv-focus inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5",
              typeFilter === "series" ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-bg/60",
            )}
          >
            <Tv className="size-3.5" />
            Series
          </button>
        </div>

        {bridgeState === "loading" ? (
          <div className="mt-7 flex min-h-40 items-center justify-center rounded-2xl border border-border bg-surface/70">
            <div className="text-center text-sm text-muted">
              <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
              Checking the optional CineplexBD catalog bridge…
            </div>
          </div>
        ) : null}

        {bridgeState === "offline" ? (
          <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface/70">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_.8fr]">
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Globe2 className="size-5" />
                  <p className="font-semibold">Browser Direct mode</p>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  Pinflix cannot read an HTTP CineplexBD API from this HTTPS page because browsers block
                  mixed active content. But top-level browser navigation is allowed, so CineplexBD can
                  still open using the same ISP connection where it already works for you.
                </p>
                {bridgeError ? (
                  <p className="mt-3 text-xs text-subtle">Optional bridge: {bridgeError}</p>
                ) : null}
              </div>

              <div className="flex flex-col justify-center gap-3 border-t border-border bg-bg/35 p-6 lg:border-l lg:border-t-0">
                <button
                  type="button"
                  onClick={directSearch}
                  className="tv-focus inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black"
                >
                  <Search className="size-4" />
                  {input.trim() ? "Search on CineplexBD" : "Open CineplexBD"}
                  <ExternalLink className="size-4" />
                </button>
                <a
                  href={CINEPLEX_HOME}
                  target="_blank"
                  rel="noreferrer"
                  className="tv-focus inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
                >
                  <Globe2 className="size-4" />
                  Browse provider
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {bridgeState === "online" && searching ? (
          <div className="mt-7 flex min-h-44 items-center justify-center rounded-2xl border border-border bg-surface/70">
            <div className="text-center text-sm text-muted">
              <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
              Searching CineplexBD…
            </div>
          </div>
        ) : null}

        {bridgeState === "online" && !searching && filtered.length ? (
          <>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={directSearch}
                className="tv-focus inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-bg/60 px-3 text-xs font-medium text-muted hover:text-fg"
              >
                <ExternalLink className="size-3.5" />
                Search directly on CineplexBD
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
              {filtered.map((item) => (
                <CineplexCard key={item.id} item={item} />
              ))}
            </div>
          </>
        ) : null}

        {bridgeState === "online" && !searching && !filtered.length ? (
          <div className="mt-7 rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
            <Film className="mx-auto size-8 text-subtle" />
            <p className="mt-3 font-semibold">{query ? "No bridge results" : "Catalog is empty"}</p>
            <p className="mt-1 text-sm text-muted">
              You can still search CineplexBD directly through your browser.
            </p>
            <button
              type="button"
              onClick={directSearch}
              className="tv-focus mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black"
            >
              <ExternalLink className="size-4" />
              Search directly
            </button>
          </div>
        ) : null}

        <p className="mt-5 text-[11px] text-subtle">
          Browser Direct uses CineplexBD on your current network. {source ? `Bridge source: ${source.name}. ` : ""}
          Pinflix does not store or copy CineplexBD's temporary signed media URLs.
        </p>
      </div>
    </section>
  );
}

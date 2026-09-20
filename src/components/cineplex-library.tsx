"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Clapperboard,
  ExternalLink,
  Film,
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

type State = "loading" | "online" | "error";
type TypeFilter = "all" | "movie" | "series";

const SOURCE_ID = "cineplexbd";

function cardType(item: MediaItem): "movie" | "series" {
  if (item.mediaType === "series" || item.type === "directory") return "series";
  return "movie";
}

function CineplexCard({ item }: { item: MediaItem }) {
  const type = cardType(item);
  const href =
    item.providerUrl ||
    (type === "series"
      ? `http://cineplexbd.net/tview.php?id=${encodeURIComponent(item.path)}`
      : `http://cineplexbd.net/view.php?id=${encodeURIComponent(item.path)}`);

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
  const [state, setState] = useState<State>("loading");
  const [source, setSource] = useState<MediaSourceSummary | null>(null);
  const [initialItems, setInitialItems] = useState<MediaItem[]>([]);
  const [searchItems, setSearchItems] = useState<MediaItem[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setError(null);

    fetch("/api/media/sources", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          sources?: MediaSourceSummary[];
          code?: string;
        };
        if (!response.ok) {
          throw new Error(
            payload.code === "BRIDGE_NOT_CONFIGURED"
              ? "Pinflix bridge is not configured in production yet."
              : "Pinflix bridge cannot currently reach your ISP network.",
          );
        }
        const found = (payload.sources ?? []).find((item) => item.id === SOURCE_ID);
        if (!found) throw new Error("CineplexBD is not configured on the Pinflix bridge.");
        return found;
      })
      .then(async (found) => {
        setSource(found);
        const params = new URLSearchParams({ source: SOURCE_ID, path: "" });
        const response = await fetch("/api/media/browse?" + params.toString(), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("CineplexBD catalog is currently unavailable.");
        const payload = (await response.json()) as MediaBrowsePayload;
        setInitialItems(payload.items ?? []);
        setState("online");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState("error");
        setSource(null);
        setInitialItems([]);
        setError(reason instanceof Error ? reason.message : "CineplexBD is unavailable.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!query) {
      setSearchItems([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setError(null);

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
        if (!response.ok) throw new Error("CineplexBD search is currently unavailable.");
        return response.json() as Promise<MediaSearchPayload>;
      })
      .then((payload) => setSearchItems(payload.items ?? []))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setSearchItems([]);
        setError(reason instanceof Error ? reason.message : "CineplexBD search failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => controller.abort();
  }, [query]);

  const items = query ? searchItems : initialItems;
  const filtered = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((item) => cardType(item) === typeFilter);
  }, [items, typeFilter]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(input.trim());
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
              Movies & series from your ISP catalog
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Uses the CineplexBD JSON search contract captured from your browser. Pinflix keeps
              temporary signed media URLs out of the catalog and opens playback on the provider page.
            </p>
          </div>

          <form onSubmit={submit} className="relative w-full xl:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search CineplexBD movies & series"
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <Server className="size-3.5" />
            CineplexBD
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <Wifi className={cn("size-3.5", state === "online" ? "text-emerald-300" : "text-subtle")} />
            {state === "online" ? "Bridge connected" : "Bridge required"}
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

        {state === "loading" ? (
          <div className="mt-7 flex min-h-56 items-center justify-center rounded-2xl border border-border bg-surface/70">
            <div className="text-center text-sm text-muted">
              <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
              Connecting to CineplexBD through the Pinflix bridge…
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <div className="mt-7 rounded-2xl border border-border bg-surface/70 p-8 text-center">
            <p className="font-semibold">CineplexBD bridge unavailable</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <p className="mt-3 text-xs text-subtle">
              The CineplexBD site in your HAR is HTTP/ISP-reachable, so the bridge must run from that
              same network and be exposed to Vercel over HTTPS.
            </p>
          </div>
        ) : null}

        {state === "online" && searching ? (
          <div className="mt-7 flex min-h-44 items-center justify-center rounded-2xl border border-border bg-surface/70">
            <div className="text-center text-sm text-muted">
              <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
              Searching CineplexBD…
            </div>
          </div>
        ) : null}

        {state === "online" && !searching && filtered.length ? (
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
            {filtered.map((item) => (
              <CineplexCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {state === "online" && !searching && !filtered.length ? (
          <div className="mt-7 rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
            <Film className="mx-auto size-8 text-subtle" />
            <p className="mt-3 font-semibold">{query ? "No CineplexBD results" : "Catalog is empty"}</p>
            <p className="mt-1 text-sm text-muted">
              {query ? "Try another title." : "Use search to query CineplexBD directly."}
            </p>
          </div>
        ) : null}

        {source ? (
          <p className="mt-5 text-[11px] text-subtle">
            Source: {source.name}. Movie IDs and metadata come from the provider; expiring media tokens are not stored.
          </p>
        ) : null}
      </div>
    </section>
  );
}

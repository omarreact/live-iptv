"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Film,
  LoaderCircle,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ArchiveCatalogPayload, ArchivePlayableItem } from "@/lib/archive/types";
import { cn } from "@/lib/utils";

type SortMode = "popular" | "latest";

function compactDownloads(value: number | null): string | null {
  if (!value || value < 1) return null;
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1) + "M plays";
  if (value >= 1_000) return (value / 1_000).toFixed(value >= 100_000 ? 0 : 1) + "K plays";
  return value + " plays";
}

function PlayableCard({
  item,
  onPlay,
}: {
  item: ArchivePlayableItem;
  onPlay: () => void;
}) {
  const downloads = compactDownloads(item.downloads);

  return (
    <article className="group min-w-0">
      <button
        type="button"
        onClick={onPlay}
        className="tv-focus block w-full rounded-2xl text-left"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-elevated shadow-lg transition duration-200 group-hover:-translate-y-1 group-hover:border-emerald-400/40 group-hover:shadow-2xl">
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/10" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-black shadow-2xl">
              <Play className="ml-1 size-6 fill-current" />
            </span>
          </div>

          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-black/60 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200 backdrop-blur">
            <Play className="size-3 fill-current" />
            Playable
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
            <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
              {item.licenseLabel}
            </span>
            {item.year ? (
              <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] text-white/70 backdrop-blur">
                {item.year}
              </span>
            ) : null}
          </div>
        </div>

        <p className="mt-2.5 line-clamp-1 text-sm font-semibold text-fg">{item.title}</p>
        <p className="mt-1 line-clamp-1 text-xs text-subtle">
          {item.creator || "Internet Archive"}
          {downloads ? " • " + downloads : ""}
        </p>
      </button>
    </article>
  );
}

export function PlayableLibrary() {
  const router = useRouter();
  const [sort, setSort] = useState<SortMode>("popular");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<ArchiveCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ sort });
    if (query.trim()) params.set("q", query.trim());

    setLoading(true);
    setError(null);

    fetch("/api/catalog/archive?" + params.toString(), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Playable catalog unavailable");
        return response.json() as Promise<ArchiveCatalogPayload>;
      })
      .then((next) => setPayload(next))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setPayload(null);
        setError(reason instanceof Error ? reason.message : "Playable catalog unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, sort]);

  const items = useMemo(() => payload?.items ?? [], [payload]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(input.trim());
  }

  function play(item: ArchivePlayableItem) {
    const params = new URLSearchParams({
      source: "internet-archive",
      path: item.identifier,
      title: item.title,
    });
    router.push("/watch/media?" + params.toString());
  }

  return (
    <section className="relative overflow-hidden border-y border-border bg-[linear-gradient(180deg,rgba(16,185,129,.06),transparent_45%)] py-9 sm:py-11">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-300">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Playable now</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              Free films that play directly in Pinflix
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Rights-signaled feature films from Internet Archive. Pinflix only lists entries with an
              explicit Creative Commons or public-domain marker and a browser-playable video file.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-2xl">
            <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search playable classics"
                aria-label="Search playable Internet Archive films"
                className="h-11 w-full rounded-xl border border-border bg-bg/70 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10"
              />
            </form>

            <div className="grid grid-cols-2 rounded-xl border border-border bg-bg/70 p-1">
              {(["popular", "latest"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSort(value)}
                  className={cn(
                    "tv-focus h-9 rounded-lg px-4 text-xs font-semibold capitalize transition",
                    sort === value
                      ? "bg-white text-black"
                      : "text-muted hover:bg-white/5 hover:text-fg",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <Archive className="size-3.5" />
            Internet Archive
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <ShieldCheck className="size-3.5 text-emerald-300" />
            Rights marker required
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
            <Film className="size-3.5" />
            MP4 / WebM / Ogg
          </span>
          {sort === "latest" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1.5">
              <CalendarDays className="size-3.5" />
              Latest first
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-7 flex min-h-56 items-center justify-center rounded-2xl border border-border bg-surface/70">
            <div className="text-center text-sm text-muted">
              <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-emerald-300" />
              Finding playable films…
            </div>
          </div>
        ) : error ? (
          <div className="mt-7 rounded-2xl border border-border bg-surface/70 p-8 text-center">
            <p className="font-semibold">Playable library unavailable</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        ) : items.length ? (
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
            {items.map((item) => (
              <PlayableCard key={item.identifier} item={item} onPlay={() => play(item)} />
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
            <Film className="mx-auto size-8 text-subtle" />
            <p className="mt-3 font-semibold">No playable films found</p>
            <p className="mt-1 text-sm text-muted">Try a shorter search, or switch back to Popular.</p>
          </div>
        )}
      </div>
    </section>
  );
}

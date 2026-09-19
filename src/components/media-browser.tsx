"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Film,
  Folder,
  LoaderCircle,
  Play,
  Search,
  Server,
  Wifi,
} from "lucide-react";
import type { MediaBrowsePayload, MediaItem, MediaSourceSummary } from "@/lib/media/types";
import { cn } from "@/lib/utils";

type SourceState = "idle" | "loading" | "online" | "error";

function parentPath(path: string): string {
  const clean = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const parts = clean.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `${parts.join("/")}/` : "";
}

function prettyTitle(name: string): string {
  return name
    .replace(/\.(?:mkv|mp4|m4v|webm|avi|mov|m2ts|mts|ts|mpg|mpeg|wmv|flv|m3u8?)$/i, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function MediaBrowser() {
  const router = useRouter();
  const [sources, setSources] = useState<MediaSourceSummary[]>([]);
  const [activeSource, setActiveSource] = useState<string>("");
  const [browse, setBrowse] = useState<MediaBrowsePayload | null>(null);
  const [state, setState] = useState<SourceState>("loading");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (source: string, path = "") => {
    setState("loading");
    setError(null);
    try {
      const params = new URLSearchParams({ source, path });
      const response = await fetch(`/api/media/browse?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("source unavailable");
      const payload = (await response.json()) as MediaBrowsePayload;
      setBrowse(payload);
      setActiveSource(source);
      setQuery("");
      setState("online");
    } catch {
      setBrowse(null);
      setActiveSource(source);
      setState("error");
      setError("This source is configured, but the bridge cannot reach it right now.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/media/sources", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("sources unavailable");
        return response.json() as Promise<{ sources?: MediaSourceSummary[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const next = payload.sources ?? [];
        setSources(next);
        if (next[0]) void load(next[0].id, "");
        else setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const items = browse?.items ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [browse, query]);

  const directories = filtered.filter((item) => item.type === "directory");
  const videos = filtered.filter((item) => item.type === "video");

  function openVideo(item: MediaItem) {
    const params = new URLSearchParams({
      source: activeSource,
      path: item.path,
      title: prettyTitle(item.name),
    });
    router.push(`/watch/media?${params.toString()}`);
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(229,9,20,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_34%)]" />
      <div className="relative p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-brand">
              <Wifi className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Network cinema</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
              Your reachable media servers, inside Pinflix
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Browse media exposed by your configured bridge. Pinflix keeps private server addresses and bridge credentials away from the browser.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter this folder"
              className="h-11 w-full rounded-xl border border-border bg-bg/70 pl-10 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </div>

        {sources.length ? (
          <div className="hide-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
            {sources.map((source) => {
              const active = source.id === activeSource;
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => void load(source.id, "")}
                  className={cn(
                    "tv-focus flex min-w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                    active
                      ? "border-brand/50 bg-brand/10 text-fg"
                      : "border-border bg-bg/60 text-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  <Server className="size-4" />
                  <span className="font-medium">{source.name}</span>
                  {active && state === "online" ? <span className="size-1.5 rounded-full bg-emerald-400" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {!sources.length && state === "idle" ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            <p className="font-medium text-fg">No network media sources are configured yet.</p>
            <p className="mt-1 leading-6">
              Add authorized/local servers to <code>MEDIA_SOURCES_JSON</code> on the Pinflix bridge; they will appear here automatically.
            </p>
          </div>
        ) : null}

        {state === "loading" ? (
          <div className="mt-8 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-bg/40">
            <div className="text-center text-sm text-muted">
              <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-brand" />
              Reading this media library…
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <div className="mt-8 rounded-2xl border border-border bg-bg/50 p-6">
            <p className="font-medium">Source unreachable</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        ) : null}

        {state === "online" && browse ? (
          <div className="mt-7">
            <div className="flex items-center gap-3">
              {browse.path ? (
                <button
                  type="button"
                  onClick={() => void load(activeSource, parentPath(browse.path))}
                  className="tv-focus flex size-9 items-center justify-center rounded-lg border border-border bg-bg/60 text-muted hover:text-fg"
                  aria-label="Back one folder"
                >
                  <ArrowLeft className="size-4" />
                </button>
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{browse.source.name}</p>
                <p className="truncate text-xs text-muted">/{browse.path || ""}</p>
              </div>
              <span className="ml-auto rounded-full border border-border bg-bg/60 px-2.5 py-1 text-[11px] text-muted">
                {videos.length} videos
              </span>
            </div>

            {directories.length ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {directories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void load(activeSource, item.path)}
                    className="tv-focus group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-bg/45 p-3 text-left transition hover:border-border-strong hover:bg-bg/70"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-brand">
                      <Folder className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">Folder</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {videos.length ? (
              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openVideo(item)}
                    className="tv-focus group overflow-hidden rounded-2xl border border-border bg-bg/55 text-left transition hover:-translate-y-0.5 hover:border-border-strong"
                  >
                    <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_25%_20%,rgba(229,9,20,0.25),transparent_32%),linear-gradient(135deg,#171717,#080808)]">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur transition group-hover:scale-105 group-hover:bg-brand">
                          <Play className="ml-0.5 size-5 fill-current" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                        {item.extension || "video"}
                      </div>
                    </div>
                    <div className="p-3.5">
                      <p className="line-clamp-2 text-sm font-medium leading-5">{prettyTitle(item.name)}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                        <Film className="size-3.5" />
                        Play in Pinflix
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {!filtered.length ? (
              <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
                Nothing in this folder matches your filter.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

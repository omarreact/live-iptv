"use client";

import { Search as SearchIcon } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Input } from "@/components/ui/input";
import type { ChannelPreview } from "@/lib/iptv/types";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchLoading() {
  return (
    <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <section className="rounded-[1.75rem] border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Search Pinflix</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Find a live signal.</h1>
        <div className="mt-6 h-12 max-w-2xl rounded-xl bg-elevated" />
      </section>
    </main>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<ChannelPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const syncFromHistory = () => {
      setQ(new URLSearchParams(window.location.search).get("q") ?? "");
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    const next = q.trim();
    const requestId = ++seq.current;
    let controller: AbortController | undefined;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      const nextUrl = params.size > 0 ? "/search?" + params.toString() : "/search";
      if ((searchParams.get("q") ?? "") !== next) {
        router.replace(nextUrl, { scroll: false });
      }

      if (next.length < 2) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }

      controller = new AbortController();
      setLoading(true);
      setError(null);
      fetch("/api/search?q=" + encodeURIComponent(next), { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("Search failed with status " + res.status);
          return res.json() as Promise<ChannelPreview[]>;
        })
        .then((rows) => {
          if (seq.current === requestId) setResults(rows);
        })
        .catch((requestError: unknown) => {
          if (requestError instanceof DOMException && requestError.name === "AbortError") return;
          if (seq.current === requestId) {
            setResults([]);
            setError("Search is temporarily unavailable. Please try again.");
          }
        })
        .finally(() => {
          if (seq.current === requestId) setLoading(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(handle);
      controller?.abort();
    };
  }, [q, router, searchParams]);

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface px-5 py-7 sm:px-8 sm:py-9">
        <div className="brand-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-20 top-0 size-64 rounded-full bg-brand/12 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Search Pinflix</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Find a live signal.</h1>
          <p className="mt-3 max-w-xl text-muted">
            Search by channel, network, category or country and jump straight into the broadcast.
          </p>
          <div className="relative mt-6 max-w-2xl">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-brand" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="BBC News, sports, Japan…"
              className="h-14 rounded-2xl pl-11 pr-4 text-base"
              autoFocus
              aria-label="Search channels"
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        {error ? (
          <div className="rounded-2xl border border-brand/25 bg-brand/8 p-5 text-sm text-fg" role="alert">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-brand" />
            Looking through the live guide…
          </div>
        ) : q.trim().length < 2 ? (
          <div className="rounded-2xl border border-border bg-surface/70 p-6 text-sm text-muted">
            Type at least two letters to search the live catalog.
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/70 p-6">
            <p className="font-semibold text-fg">No matching live channels</p>
            <p className="mt-1 text-sm text-muted">Try a broader channel, category, or country name.</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Search results</p>
                <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em]">
                  {results.length} {results.length === 1 ? "channel" : "channels"}
                </h2>
              </div>
              <p className="max-w-xs truncate text-sm text-muted">“{q.trim()}”</p>
            </div>
            <ChannelGrid channels={results} />
          </>
        )}
      </section>
    </main>
  );
}

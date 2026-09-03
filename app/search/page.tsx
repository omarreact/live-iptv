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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Search</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Find a station</h1>
      <div className="mt-6 h-12 max-w-xl rounded-lg bg-elevated" />
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
      const nextUrl = params.size > 0 ? `/search?${params.toString()}` : "/search";
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
      fetch(`/api/search?q=${encodeURIComponent(next)}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Search</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Find a station</h1>
      <div className="relative mt-6 max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Al Jazeera, sports, Japan…"
          className="pl-10"
          autoFocus
          aria-label="Search channels"
        />
      </div>
      <div className="mt-8">
        {error ? (
          <p className="text-sm text-live" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="text-sm text-muted">Looking through the guide…</p>
        ) : q.trim().length < 2 ? (
          <p className="text-sm text-muted">
            Type at least two letters to search the live catalog.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted">No stations matched “{q.trim()}”.</p>
        ) : (
          <>
            <p className="mb-5 text-sm text-muted">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            <ChannelGrid channels={results} />
          </>
        )}
      </div>
    </main>
  );
}

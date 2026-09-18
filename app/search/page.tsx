"use client";

import { Search as SearchIcon } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Input } from "@/components/ui/input";
import { CatalogLoading, SearchLoadingState } from "@/components/loading";
import type { ChannelPreview } from "@/lib/iptv/types";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchLoading() {
  return <CatalogLoading label="Opening global search" />;
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
            setError("Search is temporarily unavailable.");
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
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Search</h1>
        <p className="mt-2 text-muted">Find channels by name, country, or category.</p>
      </header>

      <div className="relative mt-5 max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search channels, countries…"
          className="h-12 rounded-xl pl-10 pr-4"
          autoFocus
          aria-label="Search channels and countries"
        />
      </div>

      <section className="mt-8">
        {error ? (
          <p className="text-sm text-brand" role="alert">{error}</p>
        ) : loading ? (
          <SearchLoadingState />
        ) : q.trim().length < 2 ? (
          <p className="text-sm text-subtle">Type at least two letters.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted">No channels found. Try a country or different spelling.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {results.length} {results.length === 1 ? "channel" : "channels"}
            </p>
            <ChannelGrid channels={results} />
          </>
        )}
      </section>
    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChannelGrid } from "@/components/channel-card";
import { Input } from "@/components/ui/input";
import { fetchSearch } from "@/lib/iptv/functions";
import type { Channel } from "@/lib/iptv/types";

type SearchParams = { q?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [q, setQ] = useState(initial ?? "");
  const [results, setResults] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    setQ(initial ?? "");
  }, [initial]);

  useEffect(() => {
    const next = q.trim();
    const handle = window.setTimeout(() => {
      void navigate({ search: { q: next || undefined }, replace: true });
      if (next.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      const id = ++seq.current;
      setLoading(true);
      fetchSearch({ data: { q: next } })
        .then((rows) => {
          if (seq.current === id) setResults(rows);
        })
        .finally(() => {
          if (seq.current === id) setLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [q, navigate]);

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
        {loading ? (
          <p className="text-sm text-muted">Looking through the guide…</p>
        ) : q.trim().length < 2 ? (
          <p className="text-sm text-muted">Type at least two letters to search the live catalog.</p>
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

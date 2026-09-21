import { Search as SearchIcon } from "lucide-react";
import { ChannelGrid } from "@/components/channel-card";
import { searchChannels } from "@/lib/iptv/provider/iptv-org";
import type { ChannelPreview } from "@/lib/iptv/types";

type SearchParams = Promise<{ q?: string | string[] }>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = first(params.q).trim();

  let results: ChannelPreview[] = [];
  let failed = false;

  if (query.length >= 2) {
    try {
      results = await searchChannels(query, 60);
    } catch (error: unknown) {
      console.error("Pinflix search failed", error);
      failed = true;
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Search</h1>
        <p className="mt-2 text-muted">Find channels by name, country, or category.</p>
      </header>

      <form action="/search" method="get" className="relative mt-5 max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search channels, countries…"
          className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
          autoFocus
          aria-label="Search channels and countries"
        />
      </form>

      <section className="mt-8">
        {failed ? (
          <p className="text-sm text-brand" role="alert">
            Search is temporarily unavailable.
          </p>
        ) : query.length < 2 ? (
          <p className="text-sm text-subtle">Type at least two letters and press Enter.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted">
            No channels found. Try a country or different spelling.
          </p>
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

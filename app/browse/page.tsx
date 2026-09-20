import Link from "next/link";
import { Search } from "lucide-react";
import { getGuideSummary } from "@/lib/iptv/provider/iptv-org";

export const dynamic = "force-dynamic";

function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export default async function BrowsePage() {
  const data = await getGuideSummary().catch((error: unknown) => {
    console.error("Unable to load the Pinflix program guide", error);
    return { total: 0, primaryCategories: [], otherCategories: [], countries: [] };
  });

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Browse</h1>
        <p className="mt-2 text-muted">Browse the curated 142-channel Pinflix Live TV guide.</p>
      </header>

      <form action="/search" method="get" className="relative mt-5 max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          placeholder="Search channels or countries"
          aria-label="Search channels or countries"
          className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </form>
<section className="mt-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Countries</h2>
            <p className="mt-1 text-sm text-muted">Popular countries by available channel count.</p>
          </div>
          <span className="hidden text-xs text-subtle sm:block">Search finds every country</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.countries.slice(0, 48).map((c) => (
            <Link
              key={c.code}
              href={"/country/" + c.code.toLowerCase()}
              className="tv-focus flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm hover:border-border-strong hover:bg-elevated"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2" aria-hidden="true">
                  {c.flag ?? flagEmoji(c.code)}
                </span>
                <span>{c.name}</span>
              </span>
              <span className="ml-3 shrink-0 text-xs text-muted">{c.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Categories</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.primaryCategories.map((cat) => (
            <Link
              key={cat.id}
              href={"/category/" + cat.id}
              className="tv-focus rounded-xl border border-border bg-surface px-4 py-4 transition-colors hover:border-border-strong hover:bg-elevated"
            >
              <p className="font-medium">{cat.name}</p>
              <p className="mt-1 text-xs text-muted">{cat.count.toLocaleString()} channels</p>
            </Link>
          ))}
        </div>

        {data.otherCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.otherCategories.map((cat) => (
              <Link
                key={cat.id}
                href={"/category/" + cat.id}
                className="tv-focus rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-border-strong hover:text-fg"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

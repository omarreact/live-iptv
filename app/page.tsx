import { Search } from "lucide-react";
import { unstable_cache } from "next/cache";
import { ChannelRow } from "@/components/channel-row";
import { RecentRow } from "@/components/recent-row";
import { getHomeData } from "@/lib/iptv/provider/iptv-org";
import type { HomeData } from "@/lib/iptv/types";

export const revalidate = 600;

const getCachedHomeData = unstable_cache(getHomeData, ["pinflix-home-data-v2"], {
  revalidate: 600,
});

export default async function HomePage() {
  const data: HomeData = await getCachedHomeData().catch((error: unknown) => {
    console.error("Unable to load the Pinflix home catalog", error);
    return { total: 0, countryCount: 0, featured: [], rows: [] };
  });

  return (
    <main className="pb-14">
      <section className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Live TV</h1>
            <p className="mt-1 text-sm text-muted">Local first. Watch the world live.</p>
          </div>
          {data.total > 0 ? (
            <p className="hidden text-xs text-subtle sm:block">
              {data.total.toLocaleString()} channels · {data.countryCount.toLocaleString()} countries
            </p>
          ) : null}
        </div>

        <form action="/search" method="get" className="relative mt-5 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            placeholder="Search channels, countries…"
            aria-label="Search channels and countries"
            className="h-12 w-full rounded-xl border border-border bg-surface pl-12 pr-4 text-[15px] text-fg outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </form>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-9">
<RecentRow />

        {data.featured.length > 0 ? (
          <ChannelRow
            category={{ id: "live", name: "Live Now", description: "", count: data.featured.length }}
            channels={data.featured}
            showAll={false}
          />
        ) : null}

        {data.rows.map((row) => (
          <ChannelRow key={row.category.id} category={row.category} channels={row.channels} />
        ))}
      </div>

      {data.total === 0 ? (
        <section className="mx-auto mt-10 max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="font-medium">The global guide is temporarily unavailable.</p>
            <p className="mt-1 text-sm text-muted">
              Local TV and Hot Now will continue trying independent providers.
            </p>
          </div>
        </section>
      ) : null}

      <footer className="mx-auto mt-14 max-w-[1400px] border-t border-border px-4 pt-6 text-xs leading-5 text-subtle sm:px-6 lg:px-8">
        Pinflix combines multiple public channel indexes and health signals. Availability varies by
        broadcaster and location.
      </footer>
    </main>
  );
}

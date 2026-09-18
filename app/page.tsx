import { headers } from "next/headers";
import { Search } from "lucide-react";
import { ChannelRow } from "@/components/channel-row";
import { HotNow } from "@/components/hot-now";
import { RecentRow } from "@/components/recent-row";
import { getFastCategoryChannels, getFastCountryChannels } from "@/lib/iptv/provider/multi";
import { countryName, resolveViewerLocation } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const location = resolveViewerLocation(await headers());

  const [local, sports, news, entertainment] = await Promise.all([
    getFastCountryChannels(location.country, 18),
    getFastCategoryChannels("sports", 16, location.country),
    getFastCategoryChannels("news", 16, location.country),
    getFastCategoryChannels("entertainment", 16, location.country),
  ]);

  const localName = countryName(location.country);

  return (
    <main className="pb-14">
      <section className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Live TV</h1>
            <p className="mt-1 text-sm text-muted">
              {location.city ? `Local TV for ${location.city}, ${localName}` : `Local TV for ${localName}`}
            </p>
          </div>
          <p className="hidden text-xs text-subtle sm:block">
            Local-first · health-aware streams
          </p>
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
        <HotNow country={location.country} />

        <ChannelRow
          category={{
            id: "local",
            name: `${localName} TV`,
            description: "",
            count: local.channels.length,
          }}
          channels={local.channels}
          viewAllHref={`/country/${location.country.toLowerCase()}`}
        />

        <RecentRow />

        <ChannelRow
          category={{ id: "sports", name: "Live Sports", description: "", count: sports.channels.length }}
          channels={sports.channels}
        />

        <ChannelRow
          category={{ id: "news", name: "News", description: "", count: news.channels.length }}
          channels={news.channels}
        />

        <ChannelRow
          category={{
            id: "entertainment",
            name: "Entertainment TV",
            description: "",
            count: entertainment.channels.length,
          }}
          channels={entertainment.channels}
        />
      </div>

      {!local.channels.length && !sports.channels.length && !news.channels.length ? (
        <section className="mx-auto mt-10 max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="font-medium">Live channels are temporarily unavailable.</p>
            <p className="mt-1 text-sm text-muted">Try again shortly.</p>
          </div>
        </section>
      ) : null}

      <footer className="mx-auto mt-14 max-w-[1400px] border-t border-border px-4 pt-6 text-xs leading-5 text-subtle sm:px-6 lg:px-8">
        Pinflix races multiple public channel indexes and prefers the first healthy result.
        Availability still varies by broadcaster and location.
      </footer>
    </main>
  );
}

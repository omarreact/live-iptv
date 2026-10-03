import Link from "next/link";
import { headers } from "next/headers";
import { ChannelCard } from "@/components/channel-card";
import { LiveGames } from "@/components/live-games";
import { getCatalog, getLocalCatalog, toPublicChannel } from "@/lib/iptv/catalog.server";

export const dynamic = "force-dynamic";

const COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "cloudfront-viewer-country",
] as const;

function getVisitorCountryCode(requestHeaders: Headers): string | null {
  for (const header of COUNTRY_HEADERS) {
    const value = requestHeaders.get(header)?.trim().toUpperCase();
    if (value && /^[A-Z]{2,3}$/.test(value) && value !== "XX") return value;
  }
  return null;
}

function localFirst<T extends { country: string | null }>(items: T[], countryCode: string | null): T[] {
  if (!countryCode) return items;
  return [...items].sort(
    (a, b) => Number(b.country === countryCode) - Number(a.country === countryCode),
  );
}

export default async function HomePage() {
  const requestHeaders = await headers();
  const visitorCountry = getVisitorCountryCode(requestHeaders);
  const [catalog, localCatalog] = await Promise.all([
    getCatalog(),
    visitorCountry?.length === 2 ? getLocalCatalog(visitorCountry) : Promise.resolve(null),
  ]);
  const publicChannels = catalog.channels.map(toPublicChannel);
  const localSourceChannels = localCatalog?.channels.length
    ? localCatalog.channels.map(toPublicChannel)
    : publicChannels.filter((channel) => channel.country === visitorCountry);
  const localChannels = localSourceChannels.slice(0, 18);
  const featuredCategories = catalog.categories.slice(0, 8);
  const sourceCount = publicChannels.reduce((sum, channel) => sum + channel.sourceCount, 0);

  return (
    <>
      <section className="hero">
        <div className="ambient-glow" />
        <div className="hero-copy">
          <span className="live-kicker"><i /> LIVE TELEVISION</span>
          <h1>All your live TV.<br/><span>One clean screen.</span></h1>
          <p>Browse the refreshed channel catalog, search instantly, and switch to backup sources automatically when an upstream stream fails.</p>
          <form className="hero-search" action="/search">
            <input name="q" type="search" placeholder="Search Bangla, news, sports, kids…" aria-label="Search channels" />
            <button type="submit">Find channel</button>
          </form>
        </div>
        <div className="hero-stats" aria-label="Catalog summary">
          <div><strong>{publicChannels.length}</strong><span>live channels</span></div>
          <div><strong>{catalog.categories.length}</strong><span>categories</span></div>
          <div><strong>{sourceCount}</strong><span>stream sources</span></div>
        </div>
      </section>

      {localChannels.length ? (
        <section className="section">
          <div className="section-heading">
            <div><span className="eyebrow">NEAR YOU · ALTERNATE SOURCES</span><h2>Local TV</h2></div>
            <span>{visitorCountry}</span>
          </div>
          <div className="channel-grid">
            {localChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                watchCountry={visitorCountry}
              />
            ))}
          </div>
        </section>
      ) : null}

      <LiveGames />

      <section className="section category-strip-section">
        <div className="section-heading">
          <div><span className="eyebrow">DISCOVER</span><h2>Browse live TV</h2></div>
        </div>
        <div className="category-strip">
          {catalog.categories.map((category) => (
            <Link className="category-pill" key={category.slug} href={"/category/" + category.slug}>
              <span>{category.name}</span><small>{category.count}</small>
            </Link>
          ))}
        </div>
      </section>

      {featuredCategories.map((category) => {
        const channels = localFirst(
          publicChannels.filter((channel) => channel.category === category.name),
          visitorCountry,
        ).slice(0, 12);
        if (!channels.length) return null;
        return (
          <section className="section" key={category.slug}>
            <div className="section-heading">
              <div><span className="eyebrow">LIVE NOW</span><h2>{category.name}</h2></div>
              <Link href={"/category/" + category.slug}>View all {category.count}</Link>
            </div>
            <div className="channel-grid">{channels.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}</div>
          </section>
        );
      })}

      {!publicChannels.length ? (
        <section className="empty-state"><h2>Catalog temporarily unavailable</h2><p>The playlist source could not be loaded. Pinflix TV will retry automatically.</p></section>
      ) : null}
    </>
  );
}

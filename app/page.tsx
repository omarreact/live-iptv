import Link from "next/link";
import { ChannelCard } from "@/components/channel-card";
import { LiveGames } from "@/components/live-games";
import { getCatalog, toPublicChannel } from "@/lib/iptv/catalog.server";

export const revalidate = 300;

export default async function HomePage() {
  const catalog = await getCatalog();
  const publicChannels = catalog.channels.map(toPublicChannel);
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
        const channels = publicChannels.filter((channel) => channel.category === category.name).slice(0, 12);
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
import Link from "next/link";
import { ChannelCard } from "@/components/channel-card";
import { getCatalog, toPublicChannel } from "@/lib/iptv/catalog.server";

export const revalidate = 300;

export default async function HomePage() {
  const catalog = await getCatalog();
  const publicChannels = catalog.channels.map(toPublicChannel);
  const featuredCategories = catalog.categories.slice(0, 7);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">LIVE TELEVISION</span>
          <h1>Find a channel. Press play. Keep watching.</h1>
          <p>
            The catalog refreshes from the supplied M3U source and automatically groups duplicate
            channel entries into backup streams.
          </p>
          <form className="hero-search" action="/search">
            <input name="q" type="search" placeholder="Search Bangla, news, sports…" aria-label="Search channels" />
            <button type="submit">Find channel</button>
          </form>
        </div>
        <div className="hero-stats" aria-label="Catalog summary">
          <div><strong>{publicChannels.length}</strong><span>channels</span></div>
          <div><strong>{catalog.categories.length}</strong><span>categories</span></div>
          <div><strong>{publicChannels.reduce((sum, channel) => sum + channel.sourceCount, 0)}</strong><span>stream sources</span></div>
        </div>
      </section>

      <section className="section category-strip-section">
        <div className="section-heading">
          <div><span className="eyebrow">BROWSE</span><h2>Categories</h2></div>
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
        const channels = publicChannels
          .filter((channel) => channel.category === category.name)
          .slice(0, 12);
        if (channels.length === 0) return null;
        return (
          <section className="section" key={category.slug}>
            <div className="section-heading">
              <div><span className="eyebrow">LIVE NOW</span><h2>{category.name}</h2></div>
              <Link href={"/category/" + category.slug}>View all {category.count}</Link>
            </div>
            <div className="channel-grid">
              {channels.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}
            </div>
          </section>
        );
      })}

      {publicChannels.length === 0 ? (
        <section className="empty-state">
          <h2>Catalog temporarily unavailable</h2>
          <p>The playlist source could not be loaded. The app will retry automatically.</p>
        </section>
      ) : null}
    </>
  );
}

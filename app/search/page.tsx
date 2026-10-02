import { ChannelCard } from "@/components/channel-card";
import { getCatalog, toPublicChannel } from "@/lib/iptv/catalog.server";

export const revalidate = 300;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const normalized = query.toLowerCase();
  const catalog = await getCatalog();

  const matches = query
    ? catalog.channels
        .filter((channel) =>
          [channel.name, channel.category, channel.country || ""]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
        .map(toPublicChannel)
    : [];

  return (
    <section className="page-shell">
      <div className="page-heading">
        <span className="eyebrow">SEARCH</span>
        <h1>{query ? 'Results for "' + query + '"' : "Search channels"}</h1>
        <p>{query ? matches.length + " matching channels" : "Type a channel, category, or country."}</p>
      </div>
      <form className="page-search" action="/search">
        <input name="q" defaultValue={query} type="search" autoFocus placeholder="Channel name, category, country…" />
        <button type="submit">Search</button>
      </form>
      {matches.length > 0 ? (
        <div className="channel-grid">
          {matches.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}
        </div>
      ) : query ? (
        <div className="empty-state"><h2>No channel found</h2><p>Try a shorter channel name or browse a category.</p></div>
      ) : null}
    </section>
  );
}

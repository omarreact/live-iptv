import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelCard } from "@/components/channel-card";
import { Player } from "@/components/player";
import { getCatalog, getChannel, getLocalCatalog, toPublicChannel } from "@/lib/iptv/catalog.server";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const [{ channelId }, query] = await Promise.all([params, searchParams]);
  const rawCountry = Array.isArray(query.country) ? query.country[0] : query.country;
  const country = rawCountry?.trim().toUpperCase();
  const localCountry = country && /^[A-Z]{2}$/.test(country) ? country : null;

  const channel = await getChannel(channelId, localCountry);
  if (!channel) notFound();

  const publicChannel = toPublicChannel(channel);
  const catalog = localCountry ? await getLocalCatalog(localCountry) : await getCatalog();
  const related = catalog.channels
    .filter((item) => item.id !== channel.id && item.category === channel.category)
    .slice(0, 8)
    .map(toPublicChannel);

  return (
    <section className="watch-page">
      <div className="watch-main">
        <div className="watch-breadcrumbs">
          <Link href="/">Live TV</Link><span>/</span>
          <Link href={"/category/" + channel.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}>{channel.category}</Link>
        </div>
        <div className="watch-title">
          {channel.logo ? <img src={channel.logo} alt="" /> : null}
          <div>
            <span className="eyebrow">LIVE CHANNEL</span>
            <h1>{channel.name}</h1>
            <p>
              {channel.category}
              {channel.country ? " · " + channel.country : ""}
              {" · "}
              {channel.sources.length} {channel.sources.length === 1 ? "source" : "fallback sources"}
            </p>
          </div>
        </div>
        <Player
          channelId={channel.id}
          name={channel.name}
          sourceKinds={publicChannel.sourceKinds}
          country={localCountry}
        />
        <div className="watch-note">
          If one source stops responding, the player moves to the next source automatically.
        </div>
      </div>

      <aside className="watch-sidebar">
        <div className="section-heading compact"><div><span className="eyebrow">MORE LIVE</span><h2>{channel.category}</h2></div></div>
        <div className="sidebar-grid">
          {related.map((item) => (
            <ChannelCard
              key={item.id}
              channel={item}
              watchCountry={localCountry}
            />
          ))}
        </div>
      </aside>
    </section>
  );
}

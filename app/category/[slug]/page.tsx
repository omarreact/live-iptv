import { notFound } from "next/navigation";
import { ChannelCard } from "@/components/channel-card";
import { getCategory, toPublicChannel } from "@/lib/iptv/catalog.server";

export const revalidate = 300;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  return (
    <section className="page-shell">
      <div className="page-heading">
        <span className="eyebrow">CATEGORY</span>
        <h1>{category.name}</h1>
        <p>{category.channels.length} live channels in this group.</p>
      </div>
      <div className="channel-grid">
        {category.channels.map((channel) => (
          <ChannelCard key={channel.id} channel={toPublicChannel(channel)} />
        ))}
      </div>
    </section>
  );
}

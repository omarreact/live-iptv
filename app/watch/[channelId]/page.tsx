import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { getChannel, getRelated } from "@/lib/iptv/catalog.server";

export default async function WatchPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  if (!channel) notFound();

  const related = await getRelated(channelId);

  return <Player channel={channel} related={related} />;
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  return { title: channel ? `${channel.shortName} · Aether` : "Aether" };
}

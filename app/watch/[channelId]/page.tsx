import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { getChannelById, getRelatedChannels } from "@/lib/iptv/provider/iptv-org";

export const revalidate = 3600;

export default async function WatchPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannelById(channelId);
  if (!channel) notFound();

  const related = await getRelatedChannels(channelId);
  return <Player key={channel.id} channel={channel} related={related} />;
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannelById(channelId);
  return { title: channel?.shortName ?? "Live channel" };
}

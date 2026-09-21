import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { getChannelById } from "@/lib/iptv/provider/iptv-org";
import { getSmartRelatedChannels } from "@/lib/iptv/related";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;

  const channel = await getChannelById(channelId);
  if (!channel) notFound();

  const related = await getSmartRelatedChannels(channel, { limit: 16 });
  return <Player key={channel.id} channel={channel} related={related} />;
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannelById(channelId);
  return { title: channel?.shortName ?? "Live channel" };
}

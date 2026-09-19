import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { getBangladeshPrivatePreviews, getPrivateChannelById } from "@/lib/iptv/private-channels";
import { isPrivateChannelId } from "@/lib/iptv/private-locator";
import { getChannelById, getRelatedChannels } from "@/lib/iptv/provider/iptv-org";
import { resolveViewerLocationWithIpFallback } from "@/lib/viewer-location";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;

  if (isPrivateChannelId(channelId)) {
    const location = await resolveViewerLocationWithIpFallback(await headers());
    if (location.country !== "BD") notFound();

    const channel = getPrivateChannelById(channelId);
    if (!channel) notFound();

    const related = getBangladeshPrivatePreviews().filter((item) => item.id !== channel.id);
    return <Player key={channel.id} channel={channel} related={related} />;
  }

  const channel = await getChannelById(channelId);
  if (!channel) notFound();

  const related = await getRelatedChannels(channelId);
  return <Player key={channel.id} channel={channel} related={related} />;
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  if (isPrivateChannelId(channelId)) {
    const channel = getPrivateChannelById(channelId);
    return { title: channel?.shortName ?? "Live channel" };
  }

  const channel = await getChannelById(channelId);
  return { title: channel?.shortName ?? "Live channel" };
}

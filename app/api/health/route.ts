import { getChannelHealthSummary } from "@/lib/iptv/health";
import { getChannelById } from "@/lib/iptv/provider/iptv-org";

export const dynamic = "force-dynamic";

/**
 * Viewer-safe channel health summary.
 * It intentionally does not expose upstream URLs, hosts, headers, or proxy details.
 */
export async function GET(request: Request) {
  const channelId = new URL(request.url).searchParams.get("channel")?.trim();
  if (!channelId || channelId.length > 256) {
    return Response.json({ error: "Invalid channel" }, { status: 400 });
  }

  const channel = await getChannelById(channelId);
  if (!channel) return Response.json({ error: "Channel not found" }, { status: 404 });

  return Response.json(
    {
      channel: channel.id,
      ...getChannelHealthSummary(channel),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

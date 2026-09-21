import { getNowNext } from "@/lib/iptv/epg";
import { getChannelById } from "@/lib/iptv/provider/iptv-org";
import { searchTmdbTitle } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const channelId = new URL(request.url).searchParams.get("channel")?.trim();
  if (!channelId || channelId.length > 256) {
    return Response.json({ error: "Invalid channel" }, { status: 400 });
  }

  const channel = await getChannelById(channelId);
  if (!channel) return Response.json({ error: "Channel not found" }, { status: 404 });
  if (!channel.guide) {
    return Response.json(
      { source: null, now: null, next: null, metadata: null },
      { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  }

  const guide = await getNowNext(channel.guide).catch(() => ({ now: null, next: null }));
  const metadata = guide.now?.title
    ? await searchTmdbTitle(guide.now.title).catch(() => null)
    : null;

  return Response.json(
    {
      source: { site: channel.guide.site, lang: channel.guide.lang },
      now: guide.now,
      next: guide.next,
      metadata,
    },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

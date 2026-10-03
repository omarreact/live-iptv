import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfficialLocalChannel } from "@/lib/iptv/official-local";

export const dynamic = "force-dynamic";

export default async function OfficialChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const channel = getOfficialLocalChannel(channelId);
  if (!channel) notFound();

  const embedUrl =
    "https://www.youtube-nocookie.com/embed/" +
    encodeURIComponent(channel.videoId) +
    "?autoplay=1&rel=0";

  return (
    <section className="watch-page">
      <div className="watch-main">
        <div className="watch-breadcrumbs">
          <Link href="/">Live TV</Link><span>/</span><span>Official local</span>
        </div>

        <div className="watch-title">
          <div>
            <span className="eyebrow">OFFICIAL LIVE SOURCE</span>
            <h1>{channel.name}</h1>
            <p>{channel.category} · {channel.country} · {channel.sourceLabel}</p>
          </div>
        </div>

        <section className="player-shell" aria-label={channel.name + " official live player"}>
          <div className="player-stage">
            <iframe
              src={embedUrl}
              title={channel.name + " live"}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                border: 0,
                display: "block",
                background: "#000",
              }}
            />
          </div>
        </section>

        <div className="watch-note">
          This player uses the broadcaster&apos;s official YouTube live stream rather than a mirrored IPTV feed.
        </div>
      </div>
    </section>
  );
}

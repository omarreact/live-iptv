import Link from "next/link";
import { ChannelLogo } from "@/components/channel-logo";
import type { OfficialLocalChannel } from "@/lib/iptv/official-local";

export function OfficialChannelCard({ channel }: { channel: OfficialLocalChannel }) {
  return (
    <Link className="channel-card" href={"/official/" + encodeURIComponent(channel.id)}>
      <div className="channel-logo-wrap">
        <ChannelLogo src="" name={channel.name} />
        <span className="live-badge">LIVE</span>
      </div>
      <div className="channel-card-body">
        <strong>{channel.name}</strong>
        <span>{channel.category} · {channel.country}</span>
        <small>{channel.sourceLabel}</small>
      </div>
    </Link>
  );
}

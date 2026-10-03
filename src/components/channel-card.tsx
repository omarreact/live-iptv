import Link from "next/link";
import type { PublicChannel } from "@/lib/iptv/types";
import { ChannelLogo } from "@/components/channel-logo";

export function ChannelCard({ channel }: { channel: PublicChannel }) {
  return (
    <Link className="channel-card" href={"/watch/" + encodeURIComponent(channel.id)}>
      <div className="channel-logo-wrap">
        <ChannelLogo src={channel.logo} name={channel.name} />
        <span className="live-badge">LIVE</span>
      </div>
      <div className="channel-card-body">
        <strong>{channel.name}</strong>
        <span>
          {channel.category}
          {channel.country ? " · " + channel.country : ""}
        </span>
        <small>
          {channel.sourceCount} {channel.sourceCount === 1 ? "source" : "sources"}
        </small>
      </div>
    </Link>
  );
}

import Link from "next/link";
import type { PublicChannel } from "@/lib/iptv/types";

export function ChannelCard({ channel }: { channel: PublicChannel }) {
  return (
    <Link className="channel-card" href={"/watch/" + encodeURIComponent(channel.id)}>
      <div className="channel-logo-wrap">
        {channel.logo ? (
          <img className="channel-logo" src={channel.logo} alt="" loading="lazy" />
        ) : (
          <span className="channel-logo-fallback">{channel.name.slice(0, 2).toUpperCase()}</span>
        )}
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

import Link from "next/link";
import type { Category, ChannelPreview } from "@/lib/iptv/types";
import { ChannelCard } from "./channel-card";

export function ChannelRow({
  category,
  channels,
  showAll = true,
}: {
  category: Category;
  channels: ChannelPreview[];
  showAll?: boolean;
}) {
  if (channels.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{category.name}</h2>
        {showAll ? (
          <Link
            href={"/category/" + category.id}
            className="shrink-0 text-sm text-muted hover:text-fg"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="hide-scrollbar mt-4 flex gap-3.5 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8">
        {channels.map((ch) => (
          <ChannelCard key={ch.id} channel={ch} />
        ))}
      </div>
    </section>
  );
}

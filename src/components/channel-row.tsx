import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-brand" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Live shelf</span>
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.035em] text-fg sm:text-[1.75rem]">
            {category.name}
          </h2>
          <p className="mt-1 text-sm text-muted">{category.description}</p>
        </div>
        {showAll ? (
          <Link
            href={"/category/" + category.id}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium text-muted transition-all duration-150 hover:border-brand/30 hover:bg-brand/10 hover:text-fg"
          >
            See all
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="hide-scrollbar flex gap-3.5 overflow-x-auto px-4 pb-2 sm:gap-4 sm:px-6 lg:px-10">
        {channels.map((ch) => (
          <ChannelCard key={ch.id} channel={ch} />
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Category, Channel } from "@/lib/iptv/types";
import { ChannelCard } from "./channel-card";

export function ChannelRow({
  category,
  channels,
  showAll = true,
}: {
  category: Category;
  channels: Channel[];
  showAll?: boolean;
}) {
  if (channels.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-4 sm:px-8">
        <div>
          <h2 className="font-display text-2xl tracking-tight text-fg sm:text-[1.75rem]">
            {category.name}
          </h2>
          <p className="text-sm text-muted">{category.description}</p>
        </div>
        {showAll ? (
          <Link
            href={`/category/${category.id}`}
            className="inline-flex h-11 items-center gap-1 text-sm text-muted transition-colors duration-150 hover:text-fg"
          >
            All
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="hide-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:gap-4 sm:px-8">
        {channels.map((ch) => (
          <ChannelCard key={ch.id} channel={ch} />
        ))}
      </div>
    </section>
  );
}

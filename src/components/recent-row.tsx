"use client";

import { useSyncExternalStore } from "react";
import { useLibrary } from "@/lib/store";
import { ChannelCard } from "./channel-card";

export function RecentRow() {
  const recent = useLibrary((s) => s.recent);
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!ready || recent.length === 0) return null;

  return (
    <section>
      <div className="px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">Continue Watching</h2>
      </div>
      <div className="hide-scrollbar mt-4 flex gap-3.5 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8">
        {recent.slice(0, 12).map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </section>
  );
}

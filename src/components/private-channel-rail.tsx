"use client";

import { useEffect, useState } from "react";
import { ChannelCard } from "@/components/channel-card";
import type { ChannelPreview } from "@/lib/iptv/types";

export function BangladeshPrivateRail({
  category,
  className = "mt-8",
}: {
  category?: string | null;
  className?: string;
}) {
  const [channels, setChannels] = useState<ChannelPreview[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (category) params.set("category", category);

    fetch("/api/private-channels" + (params.size ? "?" + params.toString() : ""), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: ChannelPreview[]) => setChannels(Array.isArray(rows) ? rows : []))
      .catch(() => setChannels([]));

    return () => controller.abort();
  }, [category]);

  if (!channels.length) return null;

  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          Bangladesh Live
        </h2>
      </div>
      <div className="hide-scrollbar mt-4 flex gap-3.5 overflow-x-auto pb-1">
        {channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </section>
  );
}

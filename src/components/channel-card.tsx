"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ChannelPreview } from "@/lib/iptv/types";
import { cn } from "@/lib/utils";

function monogram(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "A";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

export function ChannelCard({
  channel,
  featured = false,
  className,
}: {
  channel: ChannelPreview;
  featured?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showLogo = Boolean(channel.logo) && !broken;

  return (
    <Link
      href={"/watch/" + channel.id}
      className={cn(
        "group flex shrink-0 flex-col gap-2.5 outline-none",
        featured ? "w-64 sm:w-72" : "w-40 sm:w-44",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-xl border border-border bg-surface transition-colors",
          "group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-ring/60",
        )}
      >
        {showLogo ? (
          <Image
            src={channel.logo}
            alt=""
            fill
            sizes={featured ? "288px" : "176px"}
            unoptimized
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="object-contain p-5"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-muted">
            {monogram(channel.shortName)}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{channel.shortName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {[channel.country, channel.quality].filter(Boolean).join(" · ") ||
            channel.groups[0] ||
            "Live TV"}
        </p>
      </div>
    </Link>
  );
}

export function ChannelGrid({ channels }: { channels: ChannelPreview[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {channels.map((ch) => (
        <ChannelCard key={ch.id} channel={ch} className="w-full" />
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useState } from "react";
import type { Channel } from "@/lib/iptv/types";
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
  channel: Channel;
  featured?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showLogo = Boolean(channel.logo) && !broken;

  return (
    <Link
      href={`/watch/${channel.id}`}
      className={cn(
        "group relative flex shrink-0 flex-col gap-2.5 outline-none",
        featured ? "w-56 sm:w-64" : "w-36 sm:w-44",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-elevated shadow-[var(--shadow-border)]",
          "transition-[box-shadow,transform] duration-200 ease-out",
          "group-hover:shadow-[var(--shadow-border-hover)] group-hover:-translate-y-0.5",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring/70",
          featured ? "aspect-[16/10] rounded-xl" : "aspect-[16/10] rounded-lg",
        )}
      >
        {showLogo ? (
          <img
            src={channel.logo}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="absolute inset-0 size-full object-contain bg-surface p-5 outline-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface">
            <span className="font-display text-2xl tracking-tight text-muted">
              {monogram(channel.shortName)}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-bg/0 transition-colors duration-200 group-hover:bg-bg/25" />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {channel.quality ? (
            <span className="rounded-xs bg-bg/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fg">
              {channel.quality}
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Play className="size-4 fill-current ml-0.5" />
          </span>
        </div>
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-medium text-fg">{channel.shortName}</p>
        <p className="truncate text-xs text-muted">
          {channel.groups[0] ?? channel.country ?? "Live"}
          {channel.geoBlocked ? " · Restricted" : ""}
        </p>
      </div>
    </Link>
  );
}

export function ChannelGrid({ channels }: { channels: Channel[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {channels.map((ch) => (
        <ChannelCard key={ch.id} channel={ch} className="w-full" />
      ))}
    </div>
  );
}

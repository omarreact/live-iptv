"use client";

import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { useState } from "react";
import type { ChannelPreview } from "@/lib/iptv/types";
import { cn } from "@/lib/utils";

function monogram(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/);
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
        "group relative flex shrink-0 flex-col gap-3 outline-none",
        featured ? "w-64 sm:w-72" : "w-40 sm:w-48",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden border border-border bg-elevated shadow-[var(--shadow-card)]",
          "transition-[border-color,box-shadow,transform] duration-250 ease-out",
          "group-hover:-translate-y-1 group-hover:border-brand/35 group-hover:shadow-[var(--shadow-border-hover)]",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring/70",
          featured ? "aspect-video rounded-2xl" : "aspect-video rounded-xl",
        )}
      >
        <div className="brand-grid pointer-events-none absolute inset-0 opacity-35" />
        {showLogo ? (
          <Image
            src={channel.logo}
            alt=""
            fill
            sizes={featured ? "(min-width: 640px) 288px, 256px" : "(min-width: 640px) 192px, 160px"}
            unoptimized
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="absolute inset-0 size-full bg-surface/45 object-contain p-5 outline-none sm:p-6"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-elevated to-surface">
            <span className="text-3xl font-black tracking-[-0.05em] text-muted">
              {monogram(channel.shortName)}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/65 via-transparent to-transparent opacity-60" />

        <div className="absolute left-2.5 top-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-brand/15">
            <span className="size-1 rounded-full bg-white" />
            Live
          </span>
        </div>

        {channel.quality ? (
          <span className="absolute right-2.5 top-2.5 rounded-full border border-white/10 bg-bg/75 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-fg backdrop-blur">
            {channel.quality}
          </span>
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center bg-bg/0 transition-colors duration-200 group-hover:bg-bg/15">
          <span className="flex size-12 scale-90 items-center justify-center rounded-full bg-white text-bg opacity-0 shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
        </div>
      </div>

      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold text-fg transition-colors group-hover:text-white">
          {channel.shortName}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <span className="truncate">{channel.groups[0] ?? channel.country ?? "Live TV"}</span>
          {channel.country ? (
            <>
              <span className="text-subtle">·</span>
              <span className="shrink-0 uppercase">{channel.country}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ChannelGrid({ channels }: { channels: ChannelPreview[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {channels.map((ch) => (
        <ChannelCard key={ch.id} channel={ch} className="w-full" />
      ))}
    </div>
  );
}

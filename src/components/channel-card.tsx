"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [loaded, setLoaded] = useState(false);
  const showLogo = Boolean(channel.logo) && !broken;
  const available = channel.available !== false;

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [channel.logo]);

  return (
    <Link
      href={"/watch/" + channel.id}
      prefetch={false}
      aria-label={available ? `Watch ${channel.shortName}` : `${channel.shortName} is currently unavailable`}
      className={cn(
        "group tv-focus flex shrink-0 flex-col gap-2.5 rounded-xl outline-none",
        !available && "opacity-70",
        featured ? "w-64 sm:w-72" : "w-40 sm:w-44",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-xl border border-border bg-surface",
          "transition-[border-color,background-color,transform] duration-150 ease-out",
          "group-hover:-translate-y-px group-hover:border-border-strong group-hover:bg-elevated",
          "group-focus-visible:border-brand",
          showLogo && !loaded && "pinflix-shimmer",
        )}
      >
        {showLogo ? (
          <Image
            src={channel.logo}
            alt=""
            fill
            sizes={featured ? "288px" : "176px"}
            unoptimized={/\.(?:svg|gif)(?:\?|$)/i.test(channel.logo)}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setBroken(true);
              setLoaded(true);
            }}
            className={cn(
              "object-contain p-5 transition-[opacity,transform] duration-300 ease-out",
              loaded ? "pinflix-artwork-ready" : "pinflix-artwork-loading",
            )}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-muted">
            {monogram(channel.shortName)}
          </div>
        )}
        {!available ? (
          <span className="absolute bottom-2 right-2 rounded-md border border-border bg-bg/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            Unavailable
          </span>
        ) : null}
      </div>

      <div className="min-w-0 px-0.5">
        <p className="truncate text-[15px] font-medium leading-5 text-fg">{channel.shortName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {channel.country || channel.groups[0] || "Live TV"}
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

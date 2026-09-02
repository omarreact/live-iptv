import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useState } from "react";
import type { Channel } from "@/lib/iptv/types";
import { Button } from "./ui/button";

export function Hero({
  channel,
  total,
  countryCount,
}: {
  channel: Channel;
  total: number;
  countryCount: number;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 80% 0%, color-mix(in oklab, var(--color-elevated) 80%, transparent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
        <div className="space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Live television
          </p>
          <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-[3.5rem]">
            The world,
            <span className="italic"> on air.</span>
          </h1>
          <p className="max-w-md text-base text-muted">
            {total.toLocaleString()} public channels from {countryCount} countries.
            Newsrooms, stadiums, and late-night signals — streaming now.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/watch/$channelId" params={{ channelId: channel.id }}>
                <Play className="size-4 fill-current ml-0.5" />
                Watch {channel.shortName}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to="/browse">Browse the guide</Link>
            </Button>
          </div>
        </div>

        <Link
          to="/watch/$channelId"
          params={{ channelId: channel.id }}
          className="group relative block overflow-hidden rounded-xl bg-elevated shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
        >
          <div className="aspect-[16/10] bg-surface">
            {channel.logo && !broken ? (
              <img
                src={channel.logo}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                className="size-full object-contain p-10 outline-none sm:p-14"
              />
            ) : (
              <div className="flex size-full items-center justify-center font-display text-4xl text-muted">
                {channel.shortName.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3.5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-live" />
                </span>
                <span className="truncate">{channel.shortName}</span>
              </p>
              <p className="truncate text-xs text-muted">
                {channel.groups[0] ?? "Featured"} · On now
              </p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-transform duration-150 group-hover:scale-105">
              <Play className="size-3.5 fill-current ml-0.5" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}

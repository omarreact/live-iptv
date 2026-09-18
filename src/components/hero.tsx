"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Globe2, Play, Radio, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ChannelPreview } from "@/lib/iptv/types";
import { Button } from "./ui/button";

export function Hero({
  channel,
  total,
  countryCount,
}: {
  channel: ChannelPreview;
  total: number;
  countryCount: number;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <div className="brand-glow pointer-events-none absolute inset-0 -z-20" />
      <div className="brand-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="pointer-events-none absolute -right-36 top-8 -z-10 size-[420px] rounded-full bg-violet/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-44 bottom-0 -z-10 size-[360px] rounded-full bg-brand/12 blur-3xl" />

      <div className="mx-auto grid max-w-[1480px] gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:py-16 xl:min-h-[590px]">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            <Radio className="size-3.5" />
            Live television · worldwide
          </div>

          <h1 className="brand-text-gradient max-w-3xl text-[3.25rem] font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[5.2rem]">
            Live TV without borders.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Jump into news, sports, movies, music and local television from around the world.
            No maze of menus—pick a signal and start watching.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-6 shadow-[var(--shadow-brand)]">
              <Link href={"/watch/" + channel.id}>
                <Play className="ml-0.5 size-4 fill-current" />
                Watch live
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="rounded-full px-6">
              <Link href="/browse">
                Explore channels
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-6 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <Radio className="size-4 text-brand" />
              <span>
                <strong className="font-semibold text-fg">{total.toLocaleString()}</strong> public
                channels
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Globe2 className="size-4 text-violet" />
              <span>
                <strong className="font-semibold text-fg">{countryCount}</strong> countries
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Sparkles className="size-4 text-success" />
              <span>Free public streams</span>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[620px] lg:mx-0 lg:justify-self-end">
          <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/18 via-transparent to-violet/20 blur-2xl" />
          <Link
            href={"/watch/" + channel.id}
            className="group block overflow-hidden rounded-[1.6rem] border border-border-strong bg-surface/85 shadow-[var(--shadow-card)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand/35 hover:shadow-[var(--shadow-border-hover)]"
          >
            <div className="relative aspect-video overflow-hidden bg-elevated">
              <div className="brand-grid absolute inset-0 opacity-40" />
              {channel.logo && !broken ? (
                <Image
                  src={channel.logo}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 44vw, 100vw"
                  unoptimized
                  referrerPolicy="no-referrer"
                  onError={() => setBroken(true)}
                  className="size-full object-contain p-12 outline-none sm:p-16"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-6xl font-black tracking-tight text-muted">
                  {channel.shortName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-brand/20">
                  <span className="size-1.5 rounded-full bg-white" />
                  Live
                </span>
                {channel.quality ? (
                  <span className="rounded-full border border-white/10 bg-bg/75 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg backdrop-blur-md">
                    {channel.quality}
                  </span>
                ) : null}
              </div>

              <div className="absolute inset-0 flex items-center justify-center bg-bg/0 transition-colors duration-300 group-hover:bg-bg/15">
                <span className="flex size-16 scale-90 items-center justify-center rounded-full bg-white text-bg opacity-0 shadow-2xl transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                  <Play className="ml-1 size-6 fill-current" />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Featured signal</p>
                <p className="mt-1 truncate text-lg font-bold text-fg">{channel.shortName}</p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {channel.groups[0] ?? "Live TV"}
                  {channel.country ? " · " + channel.country : ""}
                </p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border-strong bg-elevated text-fg transition-all duration-200 group-hover:border-brand/40 group-hover:bg-brand group-hover:text-white">
                <Play className="ml-0.5 size-4 fill-current" />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

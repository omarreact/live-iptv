"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { useState } from "react";
import type { ChannelPreview } from "@/lib/iptv/types";
import { Button } from "./ui/button";

export function Hero({
  channel,
  total,
}: {
  channel: ChannelPreview;
  total: number;
  countryCount: number;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Watch live TV.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Browse public live channels from around the world and start watching in one click.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button asChild size="lg">
              <Link href={"/watch/" + channel.id}>
                <Play className="size-4 fill-current" />
                Watch now
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/browse">Browse channels</Link>
            </Button>
          </div>
          {total > 0 ? (
            <p className="mt-5 text-sm text-subtle">
              {total.toLocaleString()} channels available
            </p>
          ) : null}
        </div>

        <Link
          href={"/watch/" + channel.id}
          className="group overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <div className="relative aspect-video bg-elevated">
            {channel.logo && !broken ? (
              <Image
                src={channel.logo}
                alt=""
                fill
                sizes="420px"
                unoptimized
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                className="object-contain p-10"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted">
                {channel.shortName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex size-12 items-center justify-center rounded-full bg-white text-black">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="truncate font-medium">{channel.shortName}</p>
            <p className="mt-0.5 text-sm text-muted">
              {[channel.groups[0], channel.country].filter(Boolean).join(" · ") || "Live TV"}
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}

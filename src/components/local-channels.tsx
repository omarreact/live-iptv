"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelCard } from "@/components/channel-card";
import type { ChannelPreview } from "@/lib/iptv/types";

type LocalPayload = {
  location?: {
    country: string;
    city: string | null;
    region: string | null;
    timezone: string | null;
    label: string;
  };
  provider?: string;
  channels?: ChannelPreview[];
};

export function LocalChannels() {
  const [payload, setPayload] = useState<LocalPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/local", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: LocalPayload | null) => setPayload(data))
      .catch(() => setPayload({ channels: [] }));

    return () => controller.abort();
  }, []);

  if (payload && !(payload.channels?.length ?? 0)) return null;

  const country = payload?.location?.country;
  const locationLabel = payload?.location
    ? payload.location.city
      ? `${payload.location.city}, ${payload.location.label}`
      : payload.location.label
    : "your area";

  return (
    <section>
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-brand" />
          <h2 className="truncate text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            Local TV · {locationLabel}
          </h2>
        </div>

        {country ? (
          <Link
            href={`/country/${country.toLowerCase()}`}
            className="shrink-0 text-sm text-muted hover:text-fg"
          >
            View all
          </Link>
        ) : null}
      </div>

      {payload?.channels?.length ? (
        <div className="hide-scrollbar mt-4 flex gap-3.5 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8">
          {payload.channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex gap-3.5 overflow-hidden px-4 sm:px-6 lg:px-8" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-40 shrink-0 sm:w-44">
              <div className="aspect-video animate-pulse rounded-xl border border-border bg-surface" />
              <div className="mt-2.5 h-4 w-24 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

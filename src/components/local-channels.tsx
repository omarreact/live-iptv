"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelCard } from "@/components/channel-card";
import type { ChannelPreview } from "@/lib/iptv/types";
import { ChannelCardsSkeletonRow } from "@/components/loading";

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
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <ChannelCardsSkeletonRow count={7} />
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelCard } from "@/components/channel-card";
import { ChannelCardsSkeletonRow } from "@/components/loading";
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
  privateChannels?: ChannelPreview[];
  channels?: ChannelPreview[];
};

function ChannelRail({
  title,
  channels,
  href,
}: {
  title: string;
  channels: ChannelPreview[];
  href?: string;
}) {
  if (!channels.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-brand" />
          <h2 className="truncate text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            {title}
          </h2>
        </div>
        {href ? (
          <Link href={href} className="shrink-0 text-sm text-muted hover:text-fg">
            View all
          </Link>
        ) : null}
      </div>
      <div className="hide-scrollbar mt-4 flex gap-3.5 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8">
        {channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </section>
  );
}

export function LocalChannels() {
  const [payload, setPayload] = useState<LocalPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/local", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: LocalPayload | null) => setPayload(data))
      .catch(() => setPayload({ channels: [], privateChannels: [] }));

    return () => controller.abort();
  }, []);

  if (
    payload &&
    !(payload.channels?.length ?? 0) &&
    !(payload.privateChannels?.length ?? 0)
  ) {
    return null;
  }

  const country = payload?.location?.country;
  const locationLabel = payload?.location
    ? payload.location.city
      ? `${payload.location.city}, ${payload.location.label}`
      : payload.location.label
    : "your area";

  if (!payload) {
    return (
      <section>
        <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8">
          <MapPin className="size-4 shrink-0 text-brand" />
          <h2 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">Local TV</h2>
        </div>
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <ChannelCardsSkeletonRow count={7} />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-9">
      {country === "BD" && (payload.privateChannels?.length ?? 0) > 0 ? (
        <ChannelRail
          title="Bangladesh Live"
          channels={payload.privateChannels ?? []}
          href="/country/bd"
        />
      ) : null}

      <ChannelRail
        title={`Local TV · ${locationLabel}`}
        channels={payload.channels ?? []}
        href={country && country !== "ZZ" ? `/country/${country.toLowerCase()}` : undefined}
      />
    </div>
  );
}

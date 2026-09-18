"use client";

import Link from "next/link";
import { Flame, Newspaper, Radio, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { HotItem } from "@/lib/hot";

function Icon({ kind }: { kind: HotItem["kind"] }) {
  if (kind === "alert") return <TriangleAlert className="size-4" />;
  if (kind === "news") return <Newspaper className="size-4" />;
  return <Radio className="size-4" />;
}

export function HotNow({ country }: { country: string }) {
  const [items, setItems] = useState<HotItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/hot?country=${encodeURIComponent(country)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((payload: { items?: HotItem[] }) => setItems(payload.items ?? []))
      .catch(() => {});

    return () => controller.abort();
  }, [country]);

  if (!items.length) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="size-4 text-brand" />
        <h2 className="text-lg font-semibold">Hot Now</h2>
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => {
          const content = (
            <>
              <div className="mt-0.5 text-brand">
                <Icon kind={item.kind} />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-fg">{item.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">{item.subtitle}</p>
              </div>
            </>
          );

          const className =
            "tv-focus flex min-w-[260px] max-w-[340px] items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-elevated";

          return item.external ? (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link key={item.id} href={item.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

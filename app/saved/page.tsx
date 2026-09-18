"use client";

import Link from "next/link";
import { Bookmark, Clock3, Compass } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/lib/store";

export default function SavedPage() {
  const saved = useLibrary((s) => s.saved);
  const recent = useLibrary((s) => s.recent);
  const clearRecent = useLibrary((s) => s.clearRecent);
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!ready) {
    return (
      <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <h1 className="text-4xl font-black tracking-[-0.045em]">My TV</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface px-5 py-7 sm:px-8 sm:py-9">
        <div className="brand-grid pointer-events-none absolute inset-0 opacity-35" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-violet/14 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            <Bookmark className="size-3.5" />
            My TV
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Your channels, one tap away.</h1>
          <p className="mt-3 max-w-xl text-muted">
            Saved stations and recent viewing stay on this device for a fast return to your favorite signals.
          </p>
        </div>
      </section>

      <section className="mt-9">
        <div className="mb-5 flex items-center gap-2">
          <Bookmark className="size-4 text-brand" />
          <h2 className="text-2xl font-bold tracking-[-0.035em]">Saved channels</h2>
        </div>
        {saved.length === 0 ? (
          <div className="rounded-[1.5rem] border border-border bg-elevated/70 px-6 py-12 text-center shadow-[var(--shadow-card)]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Bookmark className="size-5" />
            </span>
            <p className="mt-4 text-xl font-bold tracking-[-0.025em]">Nothing pinned yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              Open any live channel and tap the bookmark icon to keep it here.
            </p>
            <Button asChild className="mt-5 rounded-full px-5">
              <Link href="/browse">
                <Compass className="size-4" />
                Explore live TV
              </Link>
            </Button>
          </div>
        ) : (
          <ChannelGrid channels={saved} />
        )}
      </section>

      {recent.length > 0 ? (
        <section className="mt-14 border-t border-border pt-10">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-violet" />
                <h2 className="text-2xl font-bold tracking-[-0.035em]">Recently watched</h2>
              </div>
              <p className="mt-1 text-sm text-muted">Jump back into channels you opened recently.</p>
            </div>
            <button
              type="button"
              onClick={clearRecent}
              className="h-10 rounded-full border border-border px-3.5 text-sm font-medium text-muted transition-all hover:border-brand/30 hover:text-fg"
            >
              Clear history
            </button>
          </div>
          <ChannelGrid channels={recent} />
        </section>
      ) : null}
    </main>
  );
}

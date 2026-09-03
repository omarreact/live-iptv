"use client";

import Link from "next/link";
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
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <h1 className="font-display text-4xl tracking-tight">Saved</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Library</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Saved</h1>
      <p className="mt-2 text-muted">Stations you pin stay on this device.</p>

      <div className="mt-8">
        {saved.length === 0 ? (
          <div className="rounded-xl bg-elevated px-5 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="font-display text-2xl tracking-tight">Nothing saved yet</p>
            <p className="mt-2 text-sm text-muted">
              Open a channel and tap the bookmark to keep it here.
            </p>
            <Button asChild className="mt-5">
              <Link href="/browse">Open the guide</Link>
            </Button>
          </div>
        ) : (
          <ChannelGrid channels={saved} />
        )}
      </div>

      {recent.length > 0 ? (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl tracking-tight">Recently watched</h2>
            <button
              type="button"
              onClick={clearRecent}
              className="h-11 text-sm text-muted transition-colors hover:text-fg"
            >
              Clear
            </button>
          </div>
          <div className="mt-5">
            <ChannelGrid channels={recent} />
          </div>
        </section>
      ) : null}
    </main>
  );
}

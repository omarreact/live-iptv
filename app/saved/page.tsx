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
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Saved</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Saved</h1>
        <p className="mt-2 text-muted">Favorites and channels you watched recently.</p>
      </header>

      <section className="mt-9">
        <h2 className="text-xl font-semibold">Favorites</h2>
        <div className="mt-4">
          {saved.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="font-medium">No favorites yet.</p>
              <p className="mt-1 text-sm text-muted">Save a channel from the player to keep it here.</p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href="/browse">Browse live channels</Link>
              </Button>
            </div>
          ) : (
            <ChannelGrid channels={saved} />
          )}
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="mt-10 border-t border-border pt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Recently Watched</h2>
            <button type="button" onClick={clearRecent} className="text-sm text-muted hover:text-fg">
              Clear
            </button>
          </div>
          <div className="mt-4">
            <ChannelGrid channels={recent} />
          </div>
        </section>
      ) : null}
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChannelGrid } from "@/components/channel-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchCategory } from "@/lib/iptv/functions";
import type { Channel } from "@/lib/iptv/types";

export const Route = createFileRoute("/category/$id")({
  loader: ({ params }) => fetchCategory({ data: { id: params.id, offset: 0 } }),
  pendingComponent: PagePending,
  component: CategoryPage,
});

function PagePending() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <Skeleton className="h-10 w-56" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[16/10] rounded-lg" />
        ))}
      </div>
    </main>
  );
}

function CategoryPage() {
  const { id } = Route.useParams();
  const page = Route.useLoaderData();
  const [extra, setExtra] = useState<Channel[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const channels = [...page.channels, ...extra];
  const remaining = page.total - channels.length;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await fetchCategory({ data: { id, offset: channels.length } });
      setExtra((cur) => [...cur, ...next.channels]);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Category</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{page.title}</h1>
      <p className="mt-2 text-muted">
        {page.subtitle} · {page.total.toLocaleString()} channels
      </p>
      <div className="mt-8">
        {channels.length ? (
          <ChannelGrid channels={channels} />
        ) : (
          <p className="text-muted">No channels in this shelf yet.</p>
        )}
      </div>
      {remaining > 0 ? (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Show more (${remaining.toLocaleString()} left)`}
          </Button>
        </div>
      ) : null}
      <div className="mt-8">
        <Button variant="ghost" asChild>
          <Link to="/browse">All categories</Link>
        </Button>
      </div>
    </main>
  );
}

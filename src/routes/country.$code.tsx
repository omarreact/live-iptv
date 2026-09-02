import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChannelGrid } from "@/components/channel-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchCountry } from "@/lib/iptv/functions";
import type { Channel } from "@/lib/iptv/types";

export const Route = createFileRoute("/country/$code")({
  loader: ({ params }) => fetchCountry({ data: { code: params.code, offset: 0 } }),
  pendingComponent: PagePending,
  component: CountryPage,
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

function CountryPage() {
  const { code } = Route.useParams();
  const page = Route.useLoaderData();
  const [extra, setExtra] = useState<Channel[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const channels = [...page.channels, ...extra];
  const remaining = page.total - channels.length;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await fetchCountry({ data: { code, offset: channels.length } });
      setExtra((cur) => [...cur, ...next.channels]);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Country</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{page.title}</h1>
      <p className="mt-2 text-muted">{page.subtitle}</p>
      <div className="mt-8">
        {channels.length ? (
          <ChannelGrid channels={channels} />
        ) : (
          <p className="text-muted">No live channels for this country right now.</p>
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
          <Link to="/browse">All countries</Link>
        </Button>
      </div>
    </main>
  );
}

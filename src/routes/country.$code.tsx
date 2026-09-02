import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChannelGrid } from "@/components/channel-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchCountry } from "@/lib/iptv/functions";
import { CATEGORY_META } from "@/lib/iptv/meta";
import type { Channel } from "@/lib/iptv/types";

export const Route = createFileRoute("/country/$code")({
  validateSearch: (search) => ({ category: typeof search.category === "string" ? search.category : undefined }),
  loader: ({ params, location }) => fetchCountry({ data: { code: params.code, category: typeof location.search.category === "string" ? location.search.category : undefined, offset: 0 } }),
  pendingComponent: PagePending,
  component: CountryPage,
});

function PagePending() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <Skeleton className="h-10 w-56" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[16/10] rounded-lg" />)}
      </div>
    </main>
  );
}

function CountryPage() {
  const { code } = Route.useParams();
  const { category: activeCategory } = Route.useSearch();
  const page = Route.useLoaderData();
  const navigate = useNavigate();
  const [extra, setExtra] = useState<Channel[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const channels = [...page.channels, ...extra];
  const remaining = page.total - channels.length;

  const categories = [
    "all",
    ...Object.entries(page.categoryCounts ?? {})
      .filter(([id]) => Boolean(CATEGORY_META[id]))
      .sort(([a], [b]) => CATEGORY_META[a].name.localeCompare(CATEGORY_META[b].name))
      .map(([id]) => id),
  ];

  async function selectCategory(next: string) {
    setExtra([]);
    await navigate({ to: "/country/$code", params: { code }, search: next === "all" ? {} : { category: next } });
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await fetchCountry({ data: { code, category: activeCategory, offset: channels.length } });
      setExtra((cur) => [...cur, ...next.channels]);
    } finally { setLoadingMore(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Country</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{page.title}</h1>
      <p className="mt-2 text-muted">{page.subtitle}</p>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Country channel categories">
        {categories.map((id) => {
          const selected = (activeCategory ?? "all") === id;
          const label = id === "all" ? "All" : `${CATEGORY_META[id].name} · ${(page.categoryCounts?.[id] ?? 0).toLocaleString()}`;
          return (
            <Button key={id} size="sm" variant={selected ? "default" : "secondary"} className="shrink-0" onClick={() => void selectCategory(id)} aria-selected={selected} role="tab">
              {label}
            </Button>
          );
        })}
      </div>

      <div className="mt-6">
        {channels.length ? <ChannelGrid channels={channels} /> : <p className="text-muted">No live channels in this category right now.</p>}
      </div>
      {remaining > 0 ? (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Show more (${remaining.toLocaleString()} left)`}
          </Button>
        </div>
      ) : null}
      <div className="mt-8"><Button variant="ghost" asChild><Link to="/browse">All countries</Link></Button></div>
    </main>
  );
}

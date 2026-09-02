import { createFileRoute } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Hero } from "@/components/hero";
import { ChannelRow } from "@/components/channel-row";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHome } from "@/lib/iptv/functions";

export const Route = createFileRoute("/")({
  loader: () => fetchHome(),
  pendingComponent: HomePending,
  errorComponent: HomeError,
  component: Home,
});

function HomeError({ error }: ErrorComponentProps) {
  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="font-display text-4xl tracking-tight">Guide unavailable</h1>
      <p className="mt-3 text-sm text-muted">
        Could not load the live catalog. {error.message}
      </p>
    </main>
  );
}

function HomePending() {
  return (
    <main className="space-y-10 pb-16">
      <div className="grid gap-8 px-4 py-12 sm:px-8 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full max-w-md" />
          <Skeleton className="h-16 w-2/3" />
        </div>
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
      </div>
      <div className="px-4 sm:px-8">
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-40 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}

function Home() {
  const data = Route.useLoaderData();
  const featured = data.featured[0];

  return (
    <main className="pb-16">
      {featured ? (
        <Hero channel={featured} total={data.total} countryCount={data.countryCount} />
      ) : (
        <section className="px-4 py-16 sm:px-8">
          <h1 className="font-display text-4xl tracking-tight">Aether</h1>
          <p className="mt-2 text-muted">The live guide is warming up.</p>
        </section>
      )}
      <div className="mt-10 space-y-10">
        {data.featured.length > 1 ? (
          <ChannelRow
            showAll={false}
            category={{
              id: "on-now",
              name: "On now",
              description: "Open these first — newsrooms that tend to stay on air",
              count: data.featured.length,
            }}
            channels={data.featured}
          />
        ) : null}
        {data.rows.map((row) => (
          <ChannelRow key={row.category.id} category={row.category} channels={row.channels} />
        ))}
      </div>
      <footer className="mx-auto mt-16 max-w-6xl px-4 text-xs text-subtle sm:px-8">
        Public streams collected by{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          className="text-muted underline decoration-border-strong underline-offset-4 hover:text-fg"
          target="_blank"
          rel="noreferrer"
        >
          iptv-org
        </a>
        . Availability depends on the broadcaster, your location, and the stream.
      </footer>
    </main>
  );
}

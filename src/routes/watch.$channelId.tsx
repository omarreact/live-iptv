import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Player } from "@/components/player";
import { fetchChannel } from "@/lib/iptv/functions";

export const Route = createFileRoute("/watch/$channelId")({
  loader: async ({ params }) => {
    const data = await fetchChannel({ data: { id: params.channelId } });
    if (!data.channel) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.channel
          ? `${loaderData.channel.shortName} · Aether`
          : "Aether",
      },
    ],
  }),
  pendingComponent: WatchPending,
  notFoundComponent: WatchMissing,
  component: WatchPage,
});

function WatchPending() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="size-10 animate-spin rounded-full border-2 border-border-strong border-t-fg" />
    </div>
  );
}

function WatchMissing() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl tracking-tight">Channel not found</h1>
      <p className="mt-3 text-muted">That station may have dropped from the live guide.</p>
      <Link to="/" className="mt-6 text-sm text-fg underline underline-offset-4">
        Return home
      </Link>
    </main>
  );
}

function WatchPage() {
  const { channel, related } = Route.useLoaderData();
  if (!channel) return null;
  return <Player channel={channel} related={related} />;
}

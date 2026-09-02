import Link from "next/link";
import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { getChannel } from "@/lib/iptv/catalog.server";

export default async function WatchPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  if (!channel) notFound();

  const related = await import("@/lib/iptv/catalog.server").then((mod) => mod.getRelated(channelId));

  return <Player channel={channel} related={related} />;
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  return { title: channel ? `${channel.shortName} · Aether` : "Aether" };
}

export function WatchMissing() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl tracking-tight">Channel not found</h1>
      <p className="mt-3 text-muted">That station may have dropped from the live guide.</p>
      <Link href="/" className="mt-6 text-sm text-fg underline underline-offset-4">
        Return home
      </Link>
    </main>
  );
}

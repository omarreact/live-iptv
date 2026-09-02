import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCountryPage } from "@/lib/iptv/catalog.server";

export const dynamic = "force-dynamic";

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const page = await getCountryPage(code, 0);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Country</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{page.title}</h1>
      <p className="mt-2 text-muted">{page.subtitle}</p>
      <div className="mt-8">
        {page.channels.length ? (
          <ChannelGrid channels={page.channels} />
        ) : (
          <p className="text-muted">No live channels for this country right now.</p>
        )}
      </div>
      <div className="mt-8">
        <Button variant="ghost" asChild>
          <Link href="/browse">All countries</Link>
        </Button>
      </div>
    </main>
  );
}

export function PagePending() {
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

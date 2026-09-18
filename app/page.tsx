import { Hero } from "@/components/hero";
import { ChannelRow } from "@/components/channel-row";
import { getHomeData } from "@/lib/iptv/provider/iptv-org";
import type { HomeData } from "@/lib/iptv/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data: HomeData = await getHomeData().catch((error: unknown) => {
    console.error("Unable to load the Pinflix home catalog", error);
    return { total: 0, countryCount: 0, featured: [], rows: [] };
  });
  const featured = data.featured[0];

  return (
    <main className="pb-14">
      {featured ? (
        <Hero channel={featured} total={data.total} countryCount={data.countryCount} />
      ) : (
        <section className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-[-0.04em]">Pinflix</h1>
          <p className="mt-3 text-muted">The live channel guide is temporarily unavailable.</p>
        </section>
      )}

      <div className="mx-auto max-w-[1320px] space-y-10 border-t border-border pt-8">
        {data.rows.map((row) => (
          <ChannelRow key={row.category.id} category={row.category} channels={row.channels} />
        ))}
      </div>

      <footer className="mx-auto mt-14 max-w-[1320px] border-t border-border px-4 pt-6 text-xs leading-5 text-subtle sm:px-6 lg:px-8">
        Public streams indexed from{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          className="underline underline-offset-4 hover:text-fg"
          target="_blank"
          rel="noreferrer"
        >
          iptv-org
        </a>
        . Availability varies by broadcaster and location.
      </footer>
    </main>
  );
}

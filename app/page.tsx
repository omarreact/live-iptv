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
    <main className="pb-16">
      {featured ? (
        <Hero channel={featured} total={data.total} countryCount={data.countryCount} />
      ) : (
        <section className="mx-auto max-w-[1480px] px-4 py-20 sm:px-6 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Pinflix live</p>
          <h1 className="mt-3 max-w-2xl text-5xl font-black tracking-[-0.055em] sm:text-6xl">
            Your world of live TV is reconnecting.
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            The live guide is temporarily unavailable. Please try again shortly.
          </p>
        </section>
      )}

      <div className="mx-auto mt-12 max-w-[1480px] space-y-12 sm:mt-14 sm:space-y-14">
        {data.featured.length > 1 ? (
          <ChannelRow
            showAll={false}
            category={{
              id: "on-now",
              name: "On now",
              description: "Reliable live signals worth opening first",
              count: data.featured.length,
            }}
            channels={data.featured}
          />
        ) : null}

        {data.rows.map((row) => (
          <ChannelRow key={row.category.id} category={row.category} channels={row.channels} />
        ))}
      </div>

      <footer className="mx-auto mt-20 max-w-[1480px] border-t border-border px-4 pt-7 text-xs leading-5 text-subtle sm:px-6 lg:px-10">
        <span className="font-semibold text-muted">PINFLIX</span> indexes public streams collected by{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          className="text-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-fg"
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

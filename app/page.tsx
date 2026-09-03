import { Hero } from "@/components/hero";
import { ChannelRow } from "@/components/channel-row";
import { getHomeData } from "@/lib/iptv/provider/iptv-org";

export const revalidate = 3600;

export default async function HomePage() {
  const data = await getHomeData();
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

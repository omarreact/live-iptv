import Image from "next/image";
import { ExternalLink, Film, Search } from "lucide-react";
import { getEntertainmentHome } from "@/lib/entertainment";

export const revalidate = 900;

export default async function EntertainmentPage() {
  const data = await getEntertainmentHome().catch(() => ({ titles: [], providers: [] as string[] }));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 text-brand">
          <Film className="size-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">Entertainment</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
          Movies & Series
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Discover movies and web series from multiple catalog sources in one place.
        </p>
      </header>

      <form action="/search" method="get" className="relative mt-6 max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          placeholder="Search Pinflix"
          aria-label="Search Pinflix"
          className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </form>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
        {data.providers.map((provider) => (
          <span key={provider} className="rounded-full border border-border bg-surface px-3 py-1.5">
            {provider}
          </span>
        ))}
      </div>

      {data.titles.length ? (
        <section className="mt-9">
          <h2 className="text-xl font-semibold">Trending & Popular</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data.titles.map((item) => (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group tv-focus rounded-xl"
              >
                <div className="pinflix-shimmer relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface transition-colors group-hover:border-border-strong">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="size-8 text-subtle" />
                    </div>
                  )}
                </div>

                <div className="mt-2.5 min-w-0">
                  <div className="flex items-start gap-1.5">
                    <p className="line-clamp-2 flex-1 text-sm font-medium leading-5">{item.title}</p>
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-subtle" />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {item.mediaType === "movie" ? "Movie" : "Series"}
                    {item.year ? ` · ${item.year}` : ""}
                    {item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-10 rounded-xl border border-border bg-surface p-6">
          <p className="font-medium">Entertainment catalog is temporarily unavailable.</p>
          <p className="mt-1 text-sm text-muted">
            Pinflix will keep Live TV available even when entertainment providers are unavailable.
          </p>
        </section>
      )}

      <footer className="mt-12 border-t border-border pt-6 text-xs leading-5 text-subtle">
        Pinflix indexes metadata and availability sources; copyrighted movies and series are not
        re-hosted by Pinflix. Playback should use official, licensed, public-domain, or authorized
        sources.
      </footer>
    </main>
  );
}

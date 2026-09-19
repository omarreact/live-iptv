import Image from "next/image";
import Link from "next/link";
import { Film, Play, Radio, Search, Server, Sparkles } from "lucide-react";
import { MediaBrowser } from "@/components/media-browser";
import { getEntertainmentHome } from "@/lib/entertainment";

export const revalidate = 900;

export default async function EntertainmentPage() {
  const data = await getEntertainmentHome().catch(() => ({ titles: [], providers: [] as string[] }));
  const featured = data.titles.find((item) => item.backdrop) ?? data.titles[0] ?? null;

  return (
    <main className="pb-12">
      <section className="relative isolate overflow-hidden border-b border-border bg-black text-white">
        {featured?.backdrop ? (
          <Image
            src={featured.backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover opacity-55"
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.74)_42%,rgba(0,0,0,0.28)_72%,rgba(0,0,0,0.72)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-transparent to-black/20" />

        <div className="mx-auto flex min-h-[470px] max-w-[1400px] items-end px-4 py-10 sm:min-h-[560px] sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-red-500">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Pinflix Entertainment</span>
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              {featured?.title ?? "Movies, series & network cinema"}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
              {featured?.overview ||
                "One cinematic home for discovery, live movie channels, and media servers available through your own network bridge."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/65">
              {featured?.mediaType ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                  {featured.mediaType === "movie" ? "Movie" : "Series"}
                </span>
              ) : null}
              {featured?.year ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">{featured.year}</span>
              ) : null}
              {featured?.rating ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                  ★ {featured.rating.toFixed(1)}
                </span>
              ) : null}
              {data.providers.map((provider) => (
                <span key={provider} className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                  {provider}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#network-cinema"
                className="tv-focus inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <Play className="size-4 fill-current" />
                Browse playable media
              </a>
              <Link
                href="/browse?category=Movies"
                className="tv-focus inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/55"
              >
                <Radio className="size-4" />
                Live movie channels
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 -mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold"><Film className="size-4 text-brand" /> Discover</div>
            <p className="mt-1.5 text-xs leading-5 text-muted">TMDB + TVmaze metadata with Pinflix caching and fallback.</p>
          </div>
          <div className="rounded-2xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold"><Server className="size-4 text-brand" /> Network sources</div>
            <p className="mt-1.5 text-xs leading-5 text-muted">Private/local libraries stay behind the authenticated Pinflix bridge.</p>
          </div>
          <div className="rounded-2xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold"><Play className="size-4 text-brand" /> In-app playback</div>
            <p className="mt-1.5 text-xs leading-5 text-muted">HLS and browser-native video first, FFmpeg compatibility fallback when needed.</p>
          </div>
        </div>

        <form action="/search" method="get" className="relative mt-8 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            placeholder="Search Pinflix"
            aria-label="Search Pinflix"
            className="h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </form>

        <div id="network-cinema" className="scroll-mt-24 pt-9">
          <MediaBrowser />
        </div>

        {data.titles.length ? (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Discover</p>
                <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Trending now</h2>
              </div>
              <p className="hidden max-w-md text-right text-xs leading-5 text-muted sm:block">
                Metadata is for discovery. Playback appears in Pinflix when a configured, authorized source provides the title.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {data.titles.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group tv-focus rounded-2xl"
                >
                  <div className="pinflix-shimmer relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 group-hover:-translate-y-1 group-hover:border-border-strong group-hover:shadow-2xl">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center"><Film className="size-8 text-subtle" /></div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white/85 backdrop-blur">
                      {item.mediaType === "movie" ? "MOVIE" : "SERIES"}
                    </div>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <p className="line-clamp-2 text-sm font-medium leading-5">{item.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.year ?? "—"}{item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ""}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="mt-12 border-t border-border pt-6 text-xs leading-5 text-subtle">
          Pinflix uses metadata APIs for discovery and only plays streams supplied by configured authorized, licensed, public-domain, or user-controlled sources. Private media endpoints remain behind the Pinflix bridge.
        </footer>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Film, Play, Radio, Server, Sparkles } from "lucide-react";
import { MediaBrowser } from "@/components/media-browser";

export const dynamic = "force-dynamic";

export default function EntertainmentPage() {
  return (
    <main className="pb-12">
      <section className="relative isolate overflow-hidden border-b border-border bg-black text-white">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_28%,rgba(229,9,20,0.26),transparent_26%),radial-gradient(circle_at_18%_16%,rgba(59,130,246,0.18),transparent_30%),linear-gradient(135deg,#050505_0%,#101010_52%,#050505_100%)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/20 to-black/40" />

        <div className="mx-auto flex min-h-[430px] max-w-[1400px] items-end px-4 py-10 sm:min-h-[500px] sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-red-500">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Pinflix Entertainment</span>
            </div>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Movies & Web Series
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
              Browse the CineplexBD movie and web-series catalog directly inside Pinflix and open playable titles in the Pinflix player.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/65">
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                CineplexBD
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                Movies
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                Web Series
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#cineplexbd"
                className="tv-focus inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <Play className="size-4 fill-current" />
                Browse CineplexBD
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
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Film className="size-4 text-brand" />
              CineplexBD catalog
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Movies and web series now come from the configured CineplexBD source instead of TMDB or TVmaze.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Server className="size-4 text-brand" />
              Private bridge
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              CineplexBD is read through the Pinflix bridge so the browser does not receive bridge credentials.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Play className="size-4 text-brand" />
              In-app playback
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Movies and episodes open in the Pinflix player with HLS/native playback and compatibility fallback.
            </p>
          </div>
        </div>

        <div id="cineplexbd" className="scroll-mt-24 pt-9">
          <MediaBrowser
            preferredSourceId="cineplexbd"
            sourceIds={["cineplexbd"]}
            eyebrow="CineplexBD"
            title="Movies & web series from CineplexBD"
            description="The catalog below is loaded from the CineplexBD source configured on your Pinflix bridge. Select a movie to play it, or open a web series to browse seasons and episodes."
          />
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-xs leading-5 text-subtle">
          Pinflix only exposes media sources configured by the operator. Availability depends on the network running the Pinflix bridge and the source permissions available there.
        </footer>
      </div>
    </main>
  );
}

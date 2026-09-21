import Link from "next/link";
import { ArrowLeft, ExternalLink, Play } from "lucide-react";
import { getTmdbDetail } from "@/lib/tmdb-catalog";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function MovieDetailsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = first(params.type) === "tv" ? "tv" : "movie";
  const id = Number.parseInt(first(params.id), 10);
  const detail = Number.isFinite(id) && id > 0 ? await getTmdbDetail(type, id) : null;

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted">This movie or show could not be loaded.</p>
        <Link
          href="/movies"
          className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Back to Movies & Shows
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/movies"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Back to Movies & Shows
      </Link>
      <section className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-8">
        {detail.backdrop ? (
          <img
            src={detail.backdrop}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-20 blur-sm"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/95 to-bg/60" />
        <div className="relative grid gap-8 sm:grid-cols-[220px_1fr]">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface">
            {detail.poster ? (
              <img src={detail.poster} alt={detail.title} className="size-full object-cover" />
            ) : null}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              {type === "tv" ? "TV Series" : "Movie"}
            </p>
            <h1 className="mt-2 text-4xl font-black">{detail.title}</h1>
            {detail.tagline ? <p className="mt-2 italic text-muted">{detail.tagline}</p> : null}
            <p className="mt-3 text-sm text-muted">
              {[
                detail.year,
                detail.rating ? `★ ${detail.rating.toFixed(1)}` : null,
                ...detail.genres,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {detail.overview ? (
              <p className="mt-6 leading-7 text-muted">{detail.overview}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
              {detail.seasons ? (
                <span className="rounded-full border border-border px-3 py-1">
                  {detail.seasons} seasons
                </span>
              ) : null}
              {detail.episodes ? (
                <span className="rounded-full border border-border px-3 py-1">
                  {detail.episodes} episodes
                </span>
              ) : null}
              {detail.runtime ? (
                <span className="rounded-full border border-border px-3 py-1">
                  {detail.runtime} min
                </span>
              ) : null}
            </div>
            {detail.trailer ? (
              <a
                href={detail.trailer}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"
              >
                <Play className="size-4 fill-current" /> Watch trailer
              </a>
            ) : null}
            {detail.watchLink ? (
              <a
                href={detail.watchLink}
                target="_blank"
                rel="noreferrer"
                className="ml-2 mt-7 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold hover:border-border-strong"
              >
                <ExternalLink className="size-4" /> Where to watch
              </a>
            ) : null}
          </div>
        </div>
      </section>
      {detail.providers.length ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Available in Bangladesh</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {detail.providers.map((provider) => (
              <span
                key={provider.name}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                {provider.logo ? (
                  <img src={provider.logo} alt="" className="size-6 rounded object-contain" />
                ) : null}
                {provider.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {detail.cast.length ? (
        <p className="mt-8 text-sm text-muted">
          <strong className="text-fg">Cast:</strong> {detail.cast.join(", ")}
        </p>
      ) : null}
    </main>
  );
}

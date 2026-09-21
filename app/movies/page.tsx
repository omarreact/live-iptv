import Link from "next/link";
import { Clapperboard, Search } from "lucide-react";
import { getTmdbHome, searchTmdbCatalog, type TmdbCatalogItem } from "@/lib/tmdb-catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movies & Shows",
  description: "Browse movies and TV shows on Pinflix.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function uniqueItems(items: TmdbCatalogItem[]): TmdbCatalogItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mediaType}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function PosterCard({ item }: { item: TmdbCatalogItem }) {
  return (
    <Link href={`/movies/details?type=${item.mediaType}&id=${item.id}`} className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface transition group-hover:-translate-y-1 group-hover:border-border-strong">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-end bg-gradient-to-br from-brand/30 to-surface p-4">
            <span className="font-semibold">{item.title}</span>
          </div>
        )}
      </div>
      <h2 className="mt-2 line-clamp-1 text-sm font-semibold">{item.title}</h2>
      <p className="mt-1 text-xs text-muted">
        {[
          item.year,
          item.rating ? `★ ${item.rating.toFixed(1)}` : null,
          item.mediaType === "tv" ? "TV" : "Movie",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Link>
  );
}

export default async function MoviesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 120);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const searchResult = query ? await searchTmdbCatalog(query, page) : null;
  const homeResult = query ? null : await getTmdbHome();
  const rawItems = searchResult
    ? searchResult.items
    : (homeResult?.sections.flatMap((section) => section.items) ?? []);
  const items = uniqueItems(rawItems);
  const error = searchResult?.error ?? homeResult?.error;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-border bg-bg/95">
        <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-muted hover:text-fg">
              Live TV
            </Link>
            <span className="text-subtle">/</span>
            <Link href="/movies" className="flex items-center gap-2 font-black">
              <Clapperboard className="size-5 text-brand" />
              Movies & Shows
            </Link>
            <form
              action="/movies"
              method="get"
              className="ml-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <Search className="size-4 text-muted" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search movies and shows…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-subtle"
              />
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
          {query ? "Search results" : "TMDB catalog"}
        </p>
        <h1 className="mt-1 text-3xl font-black">
          {query ? `Results for “${query}”` : "Movies & TV Shows"}
        </h1>

        {error ? (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : items.length ? (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => (
              <PosterCard key={`${item.mediaType}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-20 text-center text-muted">No movies or shows were found.</p>
        )}
      </main>
    </div>
  );
}

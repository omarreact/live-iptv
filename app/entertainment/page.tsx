import {
  EntertainmentCatalog,
  EntertainmentHeader,
  EntertainmentHome,
  EntertainmentSearchResults,
  type EntertainmentView,
} from "@/components/entertainment/catalog";
import {
  normalizeMovieBoxCatalog,
  normalizeMovieBoxHome,
} from "@/lib/media/normalize-moviebox";
import {
  getAnimation,
  getHome,
  getMovies,
  getTvSeries,
  search,
} from "@/lib/moviebox/service";
import type { MovieBoxCategoryResponse } from "@/lib/moviebox/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entertainment",
  description: "Browse movies, TV series, animation, and available playback on Pinflix.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseView(value: string): EntertainmentView {
  return value === "movies" ||
    value === "series" ||
    value === "animation"
    ? value
    : "home";
}

function parsePage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function EntertainmentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = parseView(first(params.view));
  const query = first(params.q).trim().slice(0, 120);
  const page = parsePage(first(params.page));
  const context = { view, query, page };

  let home = null;
  let catalog: MovieBoxCategoryResponse | null = null;

  if (query) {
    const result = await search(query, page);
    catalog = {
      page,
      per_page: 24,
      total: result.total,
      items: result.items,
    };
  } else if (view === "home") {
    home = await getHome();
  } else if (view === "movies") {
    catalog = await getMovies(page);
  } else if (view === "series") {
    catalog = await getTvSeries(page);
  } else {
    catalog = await getAnimation(page);
  }

  const heading =
    view === "movies"
      ? "Movies"
      : view === "series"
        ? "TV Series"
        : "Animation";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <EntertainmentHeader context={context} />

      <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        {query && catalog ? (
          <EntertainmentSearchResults
            query={query}
            catalog={normalizeMovieBoxCatalog(catalog)}
            context={context}
          />
        ) : view === "home" && home ? (
          <EntertainmentHome home={normalizeMovieBoxHome(home)} />
        ) : catalog ? (
          <EntertainmentCatalog
            title={heading}
            catalog={normalizeMovieBoxCatalog(catalog)}
            context={context}
          />
        ) : (
          <p className="py-20 text-center text-muted">
            Entertainment is unavailable right now.
          </p>
        )}
      </main>
    </div>
  );
}

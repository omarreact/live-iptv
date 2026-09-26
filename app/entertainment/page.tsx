import {
  EntertainmentCatalog,
  EntertainmentHeader,
  EntertainmentHome,
  EntertainmentSearchResults,
  type EntertainmentView,
} from "@/components/entertainment/catalog";
import {
  getCineplexCatalog,
  getCineplexHome,
  searchCineplex,
} from "@/lib/cineplex/service.server";
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
import type {
  MediaCatalogPage,
  MediaHome,
  MediaItem,
} from "@/types/catalog";

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

function uniqueItems(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id || item.detailKey || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeCatalog(
  primary: MediaCatalogPage | null,
  secondary: MediaCatalogPage | null,
  page: number,
): MediaCatalogPage | null {
  if (!primary && !secondary) return null;
  const items = uniqueItems([
    ...(primary?.items ?? []),
    ...(secondary?.items ?? []),
  ]);
  return {
    page,
    perPage: Math.max(primary?.perPage ?? 0, items.length || 24),
    total: Math.max(primary?.total ?? 0, primary?.items.length ?? 0) +
      (secondary?.items.length ?? 0),
    items,
  };
}

function mergeHome(primary: MediaHome | null, secondary: MediaHome | null): MediaHome | null {
  if (!primary && !secondary) return null;

  const primarySections = primary?.sections ?? [];
  const secondarySections = secondary?.sections ?? [];
  const banner = primarySections.filter((section) => section.title === "Banner");
  const rest = primarySections.filter((section) => section.title !== "Banner");
  const sections = [...banner, ...secondarySections, ...rest];

  return {
    status: sections.length ? "success" : "error",
    sections,
    ...(!sections.length
      ? { error: primary?.error ?? secondary?.error ?? "Entertainment is unavailable right now." }
      : {}),
  };
}

function normalizeSearchResult(
  result: MovieBoxCategoryResponse,
): MediaCatalogPage {
  return normalizeMovieBoxCatalog(result);
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

  let home: MediaHome | null = null;
  let catalog: MediaCatalogPage | null = null;

  if (query) {
    const [movieBoxResult, cineplexResult] = await Promise.allSettled([
      search(query, page),
      searchCineplex(query, page),
    ]);

    const movieBoxCatalog =
      movieBoxResult.status === "fulfilled"
        ? normalizeSearchResult({
            page,
            per_page: 24,
            total: movieBoxResult.value.total,
            items: movieBoxResult.value.items,
          })
        : null;

    const cineplexCatalog =
      cineplexResult.status === "fulfilled" ? cineplexResult.value : null;

    catalog = mergeCatalog(movieBoxCatalog, cineplexCatalog, page);
  } else if (view === "home") {
    const [movieBoxResult, cineplexResult] = await Promise.allSettled([
      getHome(),
      getCineplexHome(),
    ]);

    home = mergeHome(
      movieBoxResult.status === "fulfilled"
        ? normalizeMovieBoxHome(movieBoxResult.value)
        : null,
      cineplexResult.status === "fulfilled" ? cineplexResult.value : null,
    );
  } else if (view === "movies") {
    const [movieBoxResult, cineplexResult] = await Promise.allSettled([
      getMovies(page),
      getCineplexCatalog("movie", page),
    ]);

    catalog = mergeCatalog(
      movieBoxResult.status === "fulfilled"
        ? normalizeMovieBoxCatalog(movieBoxResult.value)
        : null,
      cineplexResult.status === "fulfilled" ? cineplexResult.value : null,
      page,
    );
  } else if (view === "series") {
    const [movieBoxResult, cineplexResult] = await Promise.allSettled([
      getTvSeries(page),
      getCineplexCatalog("series", page),
    ]);

    catalog = mergeCatalog(
      movieBoxResult.status === "fulfilled"
        ? normalizeMovieBoxCatalog(movieBoxResult.value)
        : null,
      cineplexResult.status === "fulfilled" ? cineplexResult.value : null,
      page,
    );
  } else {
    const result = await getAnimation(page).catch(() => null);
    catalog = result ? normalizeMovieBoxCatalog(result) : null;
  }

  const heading =
    view === "movies"
      ? "Movies"
      : view === "series"
        ? "TV Series"
        : "Animation";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
            Pinflix Entertainment
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] text-fg sm:text-4xl">
            Find something worth watching
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Movies, TV shows and animation from Pinflix providers, with fast filters
            and dedicated playback pages.
          </p>
        </div>

        <EntertainmentHeader context={context} />

        {query && catalog ? (
          <EntertainmentSearchResults
            query={query}
            catalog={catalog}
            context={context}
          />
        ) : view === "home" && home ? (
          <EntertainmentHome home={home} />
        ) : catalog ? (
          <EntertainmentCatalog
            title={heading}
            catalog={catalog}
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

import {
  EntertainmentCatalog,
  EntertainmentHeader,
  EntertainmentHome,
  EntertainmentSearchResults,
  type EntertainmentView,
} from "@/components/entertainment/catalog";
import { EntertainmentDetailPlayer } from "@/components/entertainment/detail-player";
import {
  normalizeMovieBoxCatalog,
  normalizeMovieBoxHome,
  normalizeMovieBoxMediaDetail,
} from "@/lib/media/normalize-moviebox";
import { normalizeMovieBoxDetail } from "@/lib/moviebox/normalize";
import {
  getAnimation,
  getDetail,
  getHome,
  getMovies,
  getTvSeries,
  search,
} from "@/lib/moviebox/service";
import type {
  MovieBoxCategoryResponse,
  MovieBoxItem,
} from "@/lib/moviebox/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

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

function closeHref({
  view,
  query,
  page,
}: {
  view: EntertainmentView;
  query: string;
  page: number;
}): string {
  const params = new URLSearchParams();

  if (view !== "home") params.set("view", view);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));

  const value = params.toString();
  return value ? `/entertainment?${value}` : "/entertainment";
}

function findItem(
  items: MovieBoxItem[],
  slug: string,
): MovieBoxItem | null {
  return items.find((item) => item.slug === slug) ?? null;
}

export default async function EntertainmentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = parseView(first(params.view));
  const query = first(params.q).trim();
  const page = parsePage(first(params.page));
  const detailSlug = first(params.detail).trim();

  const context = { view, query, page };

  let visibleItems: MovieBoxItem[] = [];
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
    visibleItems = result.items;
  } else if (view === "home") {
    home = await getHome();
    visibleItems = home.sections.flatMap((section) => section.items);
  } else if (view === "movies") {
    catalog = await getMovies(page);
    visibleItems = catalog.items;
  } else if (view === "series") {
    catalog = await getTvSeries(page);
    visibleItems = catalog.items;
  } else {
    catalog = await getAnimation(page);
    visibleItems = catalog.items;
  }

  let detail = null;

  if (detailSlug) {
    const fallback =
      findItem(visibleItems, detailSlug) ??
      ({
        name: "Entertainment title",
        poster_url: null,
        slug: detailSlug,
        subject_id: null,
        kind: "mixed",
      } satisfies MovieBoxItem);

    try {
      detail = normalizeMovieBoxMediaDetail(
        normalizeMovieBoxDetail(
          await getDetail(detailSlug),
          fallback,
        ),
        fallback,
      );
    } catch (error: unknown) {
      console.error("[entertainment] detail failed", error);
    }
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
          <EntertainmentHome
            home={normalizeMovieBoxHome(home)}
            context={context}
          />
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

      {detail ? (
        <EntertainmentDetailPlayer
          detail={detail}
          closeHref={closeHref(context)}
        />
      ) : null}
    </div>
  );
}

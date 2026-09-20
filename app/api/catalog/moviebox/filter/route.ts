import { getMovieBoxCatalog, getMovieBoxDetail } from "@/lib/moviebox/public.server";
import type { MovieBoxCatalogItem, MovieBoxDetailPayload } from "@/lib/moviebox/types";

export const dynamic = "force-dynamic";

type EnrichedItem = {
  item: MovieBoxCatalogItem;
  detail: MovieBoxDetailPayload | null;
  sourceIndex: number;
};

function dedupe(items: MovieBoxCatalogItem[]): MovieBoxCatalogItem[] {
  const seen = new Set<string>();
  const result: MovieBoxCatalogItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function matchesYear(year: string | null, value: string): boolean {
  if (!value || value === "all") return true;
  if (!year) return false;

  const numeric = Number.parseInt(year, 10);
  if (!Number.isFinite(numeric)) return false;

  if (/^\d{4}$/.test(value)) return numeric === Number.parseInt(value, 10);
  if (value === "2010s") return numeric >= 2010 && numeric <= 2019;
  if (value === "2000s") return numeric >= 2000 && numeric <= 2009;
  if (value === "1990s") return numeric >= 1990 && numeric <= 1999;
  if (value === "1980s") return numeric >= 1980 && numeric <= 1989;
  return true;
}

async function enrich(items: MovieBoxCatalogItem[]): Promise<EnrichedItem[]> {
  const result: EnrichedItem[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (!item) continue;

      try {
        const detail = await getMovieBoxDetail(item.href);
        result[index] = { item, detail, sourceIndex: index };
      } catch {
        result[index] = { item, detail: null, sourceIndex: index };
      }
    }
  }

  const workerCount = Math.min(8, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return result.filter(Boolean);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const kind = url.searchParams.get("kind") ?? "all";
  const genre = url.searchParams.get("genre") ?? "all";
  const country = url.searchParams.get("country") ?? "all";
  const year = url.searchParams.get("year") ?? "all";
  const sort = url.searchParams.get("sort") ?? "featured";

  try {
    const catalog = await getMovieBoxCatalog();
    let items = dedupe(catalog.rows.flatMap((row) => row.items));

    if (kind === "movie" || kind === "series") {
      items = items.filter((item) => item.kind === kind);
    }

    if (q) {
      items = items.filter((item) => item.title.toLowerCase().includes(q));
    }

    const requiresDetails =
      year !== "all" ||
      genre !== "all" ||
      country !== "all" ||
      sort === "latest" ||
      sort === "rating";

    let enriched: EnrichedItem[];

    if (requiresDetails) {
      enriched = await enrich(items.slice(0, 72));
    } else {
      enriched = items.slice(0, 72).map((item, sourceIndex) => ({
        item,
        detail: null,
        sourceIndex,
      }));
    }

    if (year !== "all") {
      enriched = enriched.filter(({ detail }) => matchesYear(detail?.year ?? null, year));
    }

    if (genre !== "all") {
      const target = genre.toLowerCase();
      enriched = enriched.filter(({ detail }) =>
        detail?.genres.some((value) => value.toLowerCase() === target),
      );
    }

    if (country !== "all") {
      enriched = enriched.filter(({ detail }) => detail?.country === country);
    }

    if (sort === "latest") {
      enriched.sort((a, b) => {
        const ay = Number.parseInt(a.detail?.year ?? "0", 10);
        const by = Number.parseInt(b.detail?.year ?? "0", 10);
        return by - ay || a.sourceIndex - b.sourceIndex;
      });
    } else if (sort === "rating") {
      enriched.sort(
        (a, b) =>
          (b.detail?.rating ?? -1) - (a.detail?.rating ?? -1) ||
          a.sourceIndex - b.sourceIndex,
      );
    } else if (sort === "az") {
      enriched.sort((a, b) => a.item.title.localeCompare(b.item.title));
    }

    return Response.json(
      {
        source: "moviebox-public",
        fetchedAt: catalog.fetchedAt,
        total: enriched.length,
        limited: items.length > 72,
        items: enriched.slice(0, 60),
      },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch {
    return Response.json(
      {
        source: "moviebox-public",
        fetchedAt: new Date().toISOString(),
        total: 0,
        limited: false,
        items: [],
        error: "Filtered MovieBox catalog is temporarily unavailable.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

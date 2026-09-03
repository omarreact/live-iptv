import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { CATEGORY_META, categoryLabel } from "@/lib/iptv/meta";
import { getChannelsByCountry } from "@/lib/iptv/provider/iptv-org";
import { parseSortMode, SORT_MODES, type SortMode } from "@/lib/iptv/sort";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<SortMode, string> = {
  default: "Best",
  quality: "Quality",
  name: "A–Z",
  streams: "Sources",
};

export default async function CountryPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ category?: string; sort?: string; page?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const sort = parseSortMode(sp.sort);
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const {
    country,
    channels,
    categoryCounts,
    categoryIds,
    totalInCountry,
    totalFiltered,
    totalPages,
    page,
  } = await getChannelsByCountry(code, sp.category, sort, requestedPage);

  if (!country && channels.length === 0) notFound();

  const title = country?.name ?? code.toUpperCase();
  const activeCategory = sp.category?.trim().toLowerCase() || null;
  const categoryName = activeCategory ? categoryLabel(activeCategory) : null;
  const base = `/country/${code.toLowerCase()}`;

  function href(next: { category?: string | null; sort?: SortMode; page?: number }) {
    const p = new URLSearchParams();
    const cat = next.category === undefined ? activeCategory : next.category;
    const s = next.sort ?? sort;
    if (cat) p.set("category", cat);
    if (s !== "default") p.set("sort", s);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const q = p.toString();
    return q ? `${base}?${q}` : base;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {country?.flag ? `${country.flag} ` : ""}
        Country
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {title}
        {categoryName ? <span className="text-muted"> · {categoryName}</span> : null}
      </h1>
      <p className="mt-2 text-muted">
        {totalFiltered.toLocaleString()} live {totalFiltered === 1 ? "channel" : "channels"}
        {categoryName ? ` in ${categoryName.toLowerCase()}` : ""}
      </p>

      {categoryIds.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <FilterChip
            href={href({ category: null })}
            active={!activeCategory}
            label="All"
            count={totalInCountry}
          />
          {categoryIds.map((id) => (
            <FilterChip
              key={id}
              href={href({ category: id })}
              active={activeCategory === id}
              label={CATEGORY_META[id]?.name ?? id}
              count={categoryCounts[id]}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Sort</span>
        {SORT_MODES.map((mode) => (
          <FilterChip
            key={mode}
            href={href({ sort: mode })}
            active={sort === mode}
            label={SORT_LABELS[mode]}
          />
        ))}
      </div>

      <div className="mt-8">
        {channels.length ? (
          <ChannelGrid channels={channels} />
        ) : (
          <p className="text-muted">No live channels for this filter right now.</p>
        )}
      </div>

      {totalPages > 1 ? (
        <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Channel pages">
          {page > 1 ? (
            <Button variant="secondary" asChild>
              <Link href={href({ page: page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm tabular-nums text-muted">
            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          {page < totalPages ? (
            <Button variant="secondary" asChild>
              <Link href={href({ page: page + 1 })}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="ghost" asChild>
          <Link href="/browse">All countries</Link>
        </Button>
        {activeCategory ? (
          <Button variant="secondary" asChild>
            <Link href={`/category/${activeCategory}?country=${code.toLowerCase()}`}>
              Open {categoryName} worldwide
            </Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "bg-elevated text-muted hover:text-fg shadow-[var(--shadow-border)]",
      )}
    >
      {label}
      {typeof count === "number" ? (
        <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-subtle")}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { code } = await params;
  const { category } = await searchParams;
  const { country } = await getChannelsByCountry(code, category);
  const name = country?.name ?? code.toUpperCase();
  const cat = category?.trim().toLowerCase();
  const catName = cat ? categoryLabel(cat) : null;
  return {
    title: catName ? `${name} · ${catName}` : name,
  };
}

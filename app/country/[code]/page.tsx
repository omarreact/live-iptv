import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { CATEGORY_META, categoryLabel } from "@/lib/iptv/meta";
import { getChannelsByCountry } from "@/lib/iptv/provider/iptv-org";
import { cn } from "@/lib/utils";

/**
 * Hierarchy: Country → Channels → Category filter (primary shelves first).
 */
export default async function CountryPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { code } = await params;
  const { category } = await searchParams;
  const { country, channels, categoryCounts, categoryIds, totalInCountry } =
    await getChannelsByCountry(code, category);

  if (!country && channels.length === 0) notFound();

  const title = country?.name ?? code.toUpperCase();
  const activeCategory = category?.trim().toLowerCase() || null;
  const categoryName = activeCategory ? categoryLabel(activeCategory) : null;

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
        {channels.length.toLocaleString()} live{" "}
        {channels.length === 1 ? "channel" : "channels"}
        {categoryName ? ` in ${categoryName.toLowerCase()}` : ""}
      </p>

      {categoryIds.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <FilterChip
            href={`/country/${code.toLowerCase()}`}
            active={!activeCategory}
            label="All"
            count={totalInCountry}
          />
          {categoryIds.map((id) => (
            <FilterChip
              key={id}
              href={`/country/${code.toLowerCase()}?category=${id}`}
              active={activeCategory === id}
              label={CATEGORY_META[id]?.name ?? id}
              count={categoryCounts[id]}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        {channels.length ? (
          <ChannelGrid channels={channels} />
        ) : (
          <p className="text-muted">No live channels for this filter right now.</p>
        )}
      </div>

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
    title: catName ? `${name} · ${catName} · Aether` : `${name} · Aether`,
  };
}

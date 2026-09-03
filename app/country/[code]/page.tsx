import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/iptv/meta";
import { getChannelsByCountry } from "@/lib/iptv/provider/iptv-org";
import { cn } from "@/lib/utils";

/**
 * Hierarchy: Country → Channels → optional Category filter.
 * All catalog work runs on the server via the iptv-org provider (Next.js fetch cache).
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
  const { country, channels, categoryCounts } = await getChannelsByCountry(code, category);

  if (!country && channels.length === 0) notFound();

  const title = country?.name ?? code.toUpperCase();
  const activeCategory = category?.trim().toLowerCase() || null;
  const categoryLabel =
    activeCategory && CATEGORY_META[activeCategory]
      ? CATEGORY_META[activeCategory].name
      : activeCategory;

  const filterKeys = Object.keys(categoryCounts)
    .filter((id) => CATEGORY_META[id] && categoryCounts[id] > 0)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {country?.flag ? `${country.flag} ` : ""}
        Country
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {title}
        {categoryLabel ? (
          <span className="text-muted"> · {categoryLabel}</span>
        ) : null}
      </h1>
      <p className="mt-2 text-muted">
        {channels.length.toLocaleString()} live{" "}
        {channels.length === 1 ? "channel" : "channels"}
        {categoryLabel ? ` in ${categoryLabel.toLowerCase()}` : ""}
      </p>

      {filterKeys.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <CategoryChip
            href={`/country/${code.toLowerCase()}`}
            active={!activeCategory}
            label="All"
            count={Object.values(categoryCounts).reduce((a, b) => a + b, 0) > 0 ? undefined : undefined}
          />
          {filterKeys.map((id) => (
            <CategoryChip
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

      <div className="mt-8">
        <Button variant="ghost" asChild>
          <Link href="/browse">All countries</Link>
        </Button>
      </div>
    </main>
  );
}

function CategoryChip({
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
        <span className={cn("text-xs", active ? "opacity-80" : "text-subtle")}>
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
  const catName = cat && CATEGORY_META[cat] ? CATEGORY_META[cat].name : null;
  return {
    title: catName ? `${name} · ${catName} · Aether` : `${name} · Aether`,
  };
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { getChannelsByCategory } from "@/lib/iptv/provider/iptv-org";
import { cn } from "@/lib/utils";

function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

/**
 * Hierarchy: Category → Channels → optional Country filter.
 * Mirrors country pages so users can start from either axis.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { id } = await params;
  const { country } = await searchParams;
  const { category, channels, countryCounts, totalInCategory } = await getChannelsByCategory(
    id,
    country,
  );

  if (!category) notFound();

  const activeCountry = country?.trim().toUpperCase() || null;
  const activeCountryMeta = activeCountry
    ? countryCounts.find((c) => c.code === activeCountry)
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Category</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {category.name}
        {activeCountryMeta ? (
          <span className="text-muted"> · {activeCountryMeta.name}</span>
        ) : null}
      </h1>
      <p className="mt-2 text-muted">
        {category.description}
        {" · "}
        {channels.length.toLocaleString()}{" "}
        {channels.length === 1 ? "channel" : "channels"}
        {activeCountryMeta ? ` in ${activeCountryMeta.name}` : ""}
      </p>

      {countryCounts.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <FilterChip
            href={`/category/${category.id}`}
            active={!activeCountry}
            label="All countries"
            count={totalInCategory}
          />
          {countryCounts.slice(0, 40).map((c) => (
            <FilterChip
              key={c.code}
              href={`/category/${category.id}?country=${c.code.toLowerCase()}`}
              active={activeCountry === c.code}
              label={`${c.flag ?? flagEmoji(c.code)} ${c.code}`}
              count={c.count}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        {channels.length ? (
          <ChannelGrid channels={channels} />
        ) : (
          <p className="text-muted">No channels for this filter yet.</p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="ghost" asChild>
          <Link href="/browse">All shelves</Link>
        </Button>
        {activeCountry ? (
          <Button variant="secondary" asChild>
            <Link href={`/country/${activeCountry.toLowerCase()}?category=${category.id}`}>
              Open {activeCountryMeta?.name ?? activeCountry} · {category.name}
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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { id } = await params;
  const { country } = await searchParams;
  const { category, countryCounts } = await getChannelsByCategory(id, country);
  const name = category?.name ?? id;
  const cc = country?.trim().toUpperCase();
  const countryName = cc ? countryCounts.find((c) => c.code === cc)?.name : null;
  return {
    title: countryName ? `${name} · ${countryName} · Aether` : `${name} · Aether`,
  };
}

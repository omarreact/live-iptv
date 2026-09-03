import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelGrid } from "@/components/channel-card";
import { Button } from "@/components/ui/button";
import { getChannelsByCategory } from "@/lib/iptv/provider/iptv-org";
import { parseSortMode, SORT_MODES, type SortMode } from "@/lib/iptv/sort";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<SortMode, string> = {
  default: "Best",
  quality: "Quality",
  name: "A–Z",
  streams: "Sources",
};

function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ country?: string; sort?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const sort = parseSortMode(sp.sort);
  const { category, channels, countryCounts, totalInCategory } = await getChannelsByCategory(
    id,
    sp.country,
    sort,
  );

  if (!category) notFound();

  const activeCountry = sp.country?.trim().toUpperCase() || null;
  const activeCountryMeta = activeCountry
    ? countryCounts.find((c) => c.code === activeCountry)
    : null;
  const base = `/category/${category.id}`;

  function href(next: { country?: string | null; sort?: SortMode }) {
    const p = new URLSearchParams();
    const cc = next.country === undefined ? activeCountry : next.country;
    const s = next.sort ?? sort;
    if (cc) p.set("country", String(cc).toLowerCase());
    if (s !== "default") p.set("sort", s);
    const q = p.toString();
    return q ? `${base}?${q}` : base;
  }

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
            href={href({ country: null })}
            active={!activeCountry}
            label="All countries"
            count={totalInCategory}
          />
          {countryCounts.slice(0, 40).map((c) => (
            <FilterChip
              key={c.code}
              href={href({ country: c.code })}
              active={activeCountry === c.code}
              label={`${c.flag ?? flagEmoji(c.code)} ${c.code}`}
              count={c.count}
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

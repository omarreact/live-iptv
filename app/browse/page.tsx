import Link from "next/link";
import { ArrowUpRight, Globe2, LayoutGrid, Radio } from "lucide-react";
import { getGuideSummary } from "@/lib/iptv/provider/iptv-org";

export const dynamic = "force-dynamic";

function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export default async function BrowsePage() {
  const data = await getGuideSummary().catch((error: unknown) => {
    console.error("Unable to load the Pinflix program guide", error);
    return { total: 0, primaryCategories: [], otherCategories: [], countries: [] };
  });

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="brand-grid pointer-events-none absolute inset-0 opacity-45" />
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-violet/18 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 size-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            <LayoutGrid className="size-3.5" />
            Explore Pinflix
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Find your next live signal.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            {data.total > 0
              ? data.total.toLocaleString() + " public channels organized by category and country."
              : "The live catalog is temporarily unavailable. Please try again shortly."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/50 px-3 py-2">
              <Radio className="size-4 text-brand" />
              Live channels
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/50 px-3 py-2">
              <Globe2 className="size-4 text-violet" />
              Worldwide coverage
            </span>
          </div>
        </div>
      </section>

      <section className="mt-10 sm:mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Browse by mood</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">Featured categories</h2>
            <p className="mt-1 text-sm text-muted">News, sports, movies, kids, culture and more</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.primaryCategories.map((cat, index) => (
            <Link
              key={cat.id}
              href={"/category/" + cat.id}
              className="group relative min-h-40 overflow-hidden rounded-2xl border border-border bg-elevated p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-[var(--shadow-border-hover)]"
            >
              <div
                className={
                  "pointer-events-none absolute -right-10 -top-10 size-32 rounded-full blur-3xl " +
                  (index % 2 === 0 ? "bg-brand/14" : "bg-violet/14")
                }
              />
              <div className="relative flex h-full flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">
                  {cat.count.toLocaleString()} channels
                </span>
                <p className="mt-3 text-xl font-bold tracking-[-0.03em] text-fg">{cat.name}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{cat.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-fg">
                  Open shelf
                  <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {data.otherCategories.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-[-0.035em]">More categories</h2>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {data.otherCategories.map((cat) => (
              <Link
                key={cat.id}
                href={"/category/" + cat.id}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition-all hover:border-brand/30 hover:bg-brand/8 hover:text-fg"
              >
                {cat.name}
                <span className="tabular-nums text-subtle">{cat.count.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet">Around the world</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">Browse by country</h2>
          <p className="mt-1 text-sm text-muted">Pick a country, then narrow it down by category</p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.countries.map((c) => (
            <Link
              key={c.code}
              href={"/country/" + c.code.toLowerCase()}
              className="group flex min-h-14 items-center justify-between rounded-xl border border-border bg-surface/75 px-4 text-sm transition-all duration-150 hover:border-violet/30 hover:bg-elevated"
            >
              <span className="min-w-0 truncate">
                <span className="mr-3 text-lg" aria-hidden="true">
                  {c.flag ?? flagEmoji(c.code)}
                </span>
                <span className="font-semibold text-fg">{c.name}</span>
              </span>
              <span className="ml-3 shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs tabular-nums text-muted group-hover:bg-panel">
                {c.count}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

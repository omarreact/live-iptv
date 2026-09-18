import Link from "next/link";
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
    <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Browse</h1>
        <p className="mt-2 text-muted">
          Find live channels by category or country.
        </p>
      </header>

      <section className="mt-9">
        <h2 className="text-xl font-semibold">Categories</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.primaryCategories.map((cat) => (
            <Link
              key={cat.id}
              href={"/category/" + cat.id}
              className="rounded-xl border border-border bg-surface px-4 py-4 transition-colors hover:border-border-strong hover:bg-elevated"
            >
              <p className="font-medium">{cat.name}</p>
              <p className="mt-1 text-xs text-muted">{cat.count.toLocaleString()} channels</p>
            </Link>
          ))}
        </div>

        {data.otherCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.otherCategories.map((cat) => (
              <Link
                key={cat.id}
                href={"/category/" + cat.id}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-border-strong hover:text-fg"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Countries</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.countries.map((c) => (
            <Link
              key={c.code}
              href={"/country/" + c.code.toLowerCase()}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm hover:border-border-strong hover:bg-surface"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2" aria-hidden="true">
                  {c.flag ?? flagEmoji(c.code)}
                </span>
                <span>{c.name}</span>
              </span>
              <span className="ml-3 shrink-0 text-xs text-muted">{c.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

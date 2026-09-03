import Link from "next/link";
import { getGuideSummary } from "@/lib/iptv/provider/iptv-org";

export const revalidate = 3600;

function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export default async function BrowsePage() {
  const data = await getGuideSummary();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Program guide</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        Every shelf, every country.
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        {data.total.toLocaleString()} channels · browse by category or country. Public streams from{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          className="text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          target="_blank"
          rel="noreferrer"
        >
          iptv-org
        </a>
        .
      </p>

      <h2 className="mt-12 font-display text-2xl tracking-tight">Main shelves</h2>
      <p className="mt-1 text-sm text-muted">News, sports, kids, movies, documentary, and more</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.primaryCategories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.id}`}
            className="group rounded-xl bg-elevated p-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
          >
            <p className="font-medium text-fg">{cat.name}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{cat.description}</p>
            <p className="mt-2 text-xs tabular-nums text-subtle">
              {cat.count.toLocaleString()} channels
            </p>
          </Link>
        ))}
      </div>

      {data.otherCategories.length > 0 ? (
        <>
          <h2 className="mt-12 font-display text-2xl tracking-tight">More categories</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.otherCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.id}`}
                className="group rounded-xl bg-elevated p-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
              >
                <p className="font-medium text-fg">{cat.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {cat.count.toLocaleString()} {cat.count === 1 ? "channel" : "channels"}
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-12">
        <h2 className="font-display text-2xl tracking-tight">Countries</h2>
        <p className="mt-1 text-sm text-muted">Open a country, then filter by shelf</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.countries.map((c) => (
            <Link
              key={c.code}
              href={`/country/${c.code.toLowerCase()}`}
              className="flex h-12 items-center justify-between rounded-lg px-3 text-sm shadow-[var(--shadow-border)] transition-colors duration-150 hover:bg-elevated"
            >
              <span className="truncate">
                <span className="mr-2" aria-hidden="true">
                  {c.flag ?? flagEmoji(c.code)}
                </span>
                <span className="mr-2 font-medium tabular-nums text-muted">{c.code}</span>
                {c.name}
              </span>
              <span className="tabular-nums text-muted">{c.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

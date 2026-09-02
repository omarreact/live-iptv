import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchBrowse } from "@/lib/iptv/functions";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/browse")({
  loader: () => fetchBrowse(),
  pendingComponent: BrowsePending,
  component: Browse,
});

function BrowsePending() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-8">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </main>
  );
}

function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

function Browse() {
  const data = Route.useLoaderData();
  const [countryQ, setCountryQ] = useState("");

  const countries = useMemo(() => {
    const q = countryQ.trim().toLowerCase();
    if (!q) return data.countries;
    return data.countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countryQ, data.countries]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Program guide</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        Every shelf, every country.
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        {data.total.toLocaleString()} channels across {data.categories.length} categories and{" "}
        {data.countries.length} countries. Public streams from{" "}
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

      <h2 className="mt-12 font-display text-2xl tracking-tight">Categories</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.categories.map((cat) => (
          <Link
            key={cat.id}
            to="/category/$id"
            params={{ id: cat.id }}
            className="group rounded-xl bg-elevated p-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
          >
            <p className="font-medium text-fg">{cat.name}</p>
            <p className="mt-1 text-xs text-muted">
              {cat.count.toLocaleString()} {cat.count === 1 ? "channel" : "channels"}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-2xl tracking-tight">Countries</h2>
        <Input
          value={countryQ}
          onChange={(e) => setCountryQ(e.target.value)}
          placeholder="Filter countries…"
          aria-label="Filter countries"
          className="sm:max-w-xs"
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <Link
            key={c.code}
            to="/country/$code"
            params={{ code: c.code.toLowerCase() }}
            search={{ category: undefined }}
            className="flex h-12 items-center justify-between rounded-lg px-3 text-sm shadow-[var(--shadow-border)] transition-colors duration-150 hover:bg-elevated"
          >
            <span className="truncate">
              <span className="mr-2" aria-hidden="true">
                {flagEmoji(c.code)}
              </span>
              <span className="mr-2 font-medium tabular-nums text-muted">{c.code}</span>
              {c.name}
            </span>
            <span className="tabular-nums text-muted">{c.count}</span>
          </Link>
        ))}
      </div>
      {countries.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No countries matched “{countryQ.trim()}”.</p>
      ) : null}
    </main>
  );
}

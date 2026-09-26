import Link from "next/link";
import {
  Clapperboard,
  Home,
  Play,
  Search,
  Sparkles,
  Tv,
} from "lucide-react";
import type {
  MediaCatalogPage,
  MediaHome,
  MediaItem,
} from "@/types/catalog";
import { cn } from "@/lib/utils";

export type EntertainmentView = "home" | "movies" | "series" | "animation";

const VIEWS: ReadonlyArray<{
  id: EntertainmentView;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "Home", icon: Home },
  { id: "movies", label: "Movies", icon: Clapperboard },
  { id: "series", label: "TV Series", icon: Tv },
  { id: "animation", label: "Animation", icon: Sparkles },
];

type CatalogContext = {
  view: EntertainmentView;
  query: string;
  page: number;
};

function paramsHref(
  context: CatalogContext,
  patch: {
    view?: EntertainmentView | null;
    query?: string | null;
    page?: number | null;
    detail?: string | null;
  },
): string {
  const params = new URLSearchParams();

  const view = patch.view === undefined ? context.view : patch.view;
  const query = patch.query === undefined ? context.query : patch.query;
  const page = patch.page === undefined ? context.page : patch.page;

  if (view && view !== "home") params.set("view", view);
  if (query) params.set("q", query);
  if (page && page > 1) params.set("page", String(page));
  if (patch.detail) params.set("detail", patch.detail);

  const value = params.toString();
  return value ? `/entertainment?${value}` : "/entertainment";
}

function titleMeta(item: MediaItem): string {
  return [item.year, item.rating ? `★ ${item.rating}` : null]
    .filter(Boolean)
    .join(" · ");
}

function PosterCard({ item }: { item: MediaItem }) {
  const content = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_10px_28px_rgba(15,23,42,.07)] transition duration-200 group-hover:-translate-y-1 group-hover:border-border-strong group-hover:shadow-[0_18px_42px_rgba(15,23,42,.12)]">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-end bg-gradient-to-br from-white/10 to-transparent p-4">
            <span className="text-sm font-semibold text-fg">{item.title}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

        {item.badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            {item.badge}
          </span>
        ) : null}

        <span className="absolute bottom-3 right-3 flex size-10 translate-y-2 items-center justify-center rounded-full bg-brand text-white opacity-0 shadow-lg shadow-brand/20 transition group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="size-4 fill-current" />
        </span>
      </div>

      <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-fg">
        {item.title}
      </h3>
      <p className="mt-0.5 min-h-4 text-xs text-muted">{titleMeta(item)}</p>
    </>
  );

  if (!item.detailKey) {
    return <div className="group min-w-0 text-left">{content}</div>;
  }

  return (
    <Link
      href={`/entertainment/${encodeURIComponent(item.detailKey)}`}
      className="group min-w-0 text-left"
    >
      {content}
    </Link>
  );
}

function PosterGrid({ items }: { items: MediaItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {items.map((item, index) => (
        <PosterCard
          key={String(item.id || item.detailKey || item.title) + "-" + index}
          item={item}
        />
      ))}
    </div>
  );
}

function Hero({ item }: { item: MediaItem }) {
  const href = item.detailKey
    ? `/entertainment/${encodeURIComponent(item.detailKey)}`
    : null;

  return (
    <section className="relative mb-9 overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_18px_55px_rgba(15,23,42,.08)]">
      {item.poster ? (
        <img
          src={item.poster}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full scale-110 object-cover opacity-20 blur-2xl"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/94 to-white/65" />

      <div className="relative grid min-h-[330px] items-center gap-8 p-6 sm:grid-cols-[180px_1fr] sm:p-8 lg:min-h-[390px] lg:grid-cols-[220px_1fr] lg:p-10">
        <div className="mx-auto aspect-[2/3] w-[160px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_20px_45px_rgba(15,23,42,.16)] sm:w-full">
          {item.poster ? (
            <img
              src={item.poster}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : null}
        </div>

        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-brand">
            Featured
          </p>
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl lg:text-5xl">
            {item.title}
          </h1>
          {titleMeta(item) ? (
            <p className="mt-3 text-sm text-muted">{titleMeta(item)}</p>
          ) : null}
          {href ? (
            <Link
              href={href}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand-strong"
            >
              <Play className="size-4 fill-current" />
              View details
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SectionRow({
  title,
  items,
}: {
  title: string;
  items: MediaItem[];
}) {
  if (!items.length) return null;

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-bold tracking-tight text-fg">{title}</h2>
        <span className="text-xs text-muted">{items.length} titles</span>
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2 sm:gap-4">
        {items.map((item, index) => (
          <div
            key={String(item.id || item.detailKey || item.title) + "-" + index}
            className="w-[132px] shrink-0 sm:w-[150px] lg:w-[166px]"
          >
            <PosterCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function EntertainmentHeader({
  context,
}: {
  context: CatalogContext;
}) {
  if (context.query) {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">Search mode</p>
          <p className="mt-0.5 text-sm text-muted">Results across movies, TV shows and animation</p>
        </div>
        <Link
          href="/entertainment"
          className="shrink-0 rounded-full border border-border bg-elevated px-3 py-2 text-xs font-bold text-muted transition hover:bg-white hover:text-fg"
        >
          Clear
        </Link>
      </div>
    );
  }

  return (
    <nav className="hide-scrollbar mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm">
      {VIEWS.map((entry) => {
        const Icon = entry.icon;
        const active = context.view === entry.id;

        return (
          <Link
            key={entry.id}
            href={paramsHref(context, {
              view: entry.id,
              query: null,
              page: null,
              detail: null,
            })}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-brand-soft text-brand shadow-sm"
                : "text-muted hover:bg-elevated hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function EntertainmentHome({
  home,
}: {
  home: MediaHome;
}) {
  const banner = home.sections.find((section) => section.title === "Banner");
  const hero = banner?.items[0] ?? home.sections[0]?.items[0] ?? null;

  return (
    <>
      {home.status === "error" ? (
        <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {home.error ?? "Entertainment is unavailable right now."}
        </p>
      ) : null}

      {hero ? <Hero item={hero} /> : null}

      {home.sections
        .filter((section) => section.title !== "Banner")
        .map((section) => (
          <SectionRow
            key={section.title}
            title={section.title}
            items={section.items}
          />
        ))}
    </>
  );
}

export function EntertainmentCatalog({
  title,
  eyebrow = "Entertainment catalog",
  catalog,
  context,
}: {
  title: string;
  eyebrow?: string;
  catalog: MediaCatalogPage;
  context: CatalogContext;
}) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / Math.max(1, catalog.perPage)));

  return (
    <section>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-black">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {catalog.total
            ? `${catalog.total.toLocaleString()} available titles`
            : "Browse titles"}
        </p>
      </div>

      {catalog.items.length ? (
        <>
          <PosterGrid items={catalog.items} />

          {totalPages > 1 ? (
            <nav
              className="mt-10 flex items-center justify-between gap-4"
              aria-label="Entertainment pages"
            >
              {context.page > 1 ? (
                <Link
                  href={paramsHref(context, {
                    page: context.page - 1,
                    detail: null,
                  })}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-border-strong"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}

              <span className="text-sm tabular-nums text-muted">
                Page {context.page.toLocaleString()} of {totalPages.toLocaleString()}
              </span>

              {context.page < totalPages ? (
                <Link
                  href={paramsHref(context, {
                    page: context.page + 1,
                    detail: null,
                  })}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-border-strong"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <p className="py-20 text-center text-muted">No titles available.</p>
      )}
    </section>
  );
}

export function EntertainmentSearchResults({
  query,
  catalog,
  context,
}: {
  query: string;
  catalog: MediaCatalogPage;
  context: CatalogContext;
}) {
  return (
    <EntertainmentCatalog
      title={`Results for “${query}”`}
      eyebrow="Search"
      catalog={catalog}
      context={context}
    />
  );
}

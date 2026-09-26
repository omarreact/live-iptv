"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Clapperboard,
  Compass,
  Film,
  House,
  Languages,
  Search,
  Sparkles,
  Tv,
} from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";

const DESKTOP_NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/browse", label: "Browse", icon: Compass, exact: false },
  { to: "/movies", label: "Movies", icon: Film, exact: false },
  { to: "/entertainment?view=series", match: "/entertainment", label: "TV Shows", icon: Tv, exact: false },
  { to: "/entertainment?view=animation", match: "/entertainment", label: "Animation", icon: Sparkles, exact: false },
  { to: "/saved", label: "Saved", icon: Bookmark, exact: false },
] as const;

const MOBILE_NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/browse", label: "Browse", icon: Compass, exact: false },
  { to: "/movies", label: "Movies", icon: Film, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
  { to: "/saved", label: "Saved", icon: Bookmark, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const watching = pathname.startsWith("/watch/");
  const entertainmentDetail = pathname.startsWith("/entertainment/");
  const standalone = watching || entertainmentDetail;
  const entertainmentListing = pathname === "/entertainment";

  if (standalone) {
    return <div className="min-h-dvh bg-bg text-fg">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[238px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-[#f8fafc] px-4 py-5 lg:flex">
        <Link
          href="/"
          className="tv-focus flex items-center gap-2.5 rounded-xl px-2 py-1.5"
          aria-label="Pinflix home"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand shadow-sm">
            <LogoMark className="size-7" />
          </span>
          <div>
            <p className="text-[15px] font-black tracking-[0.08em] text-fg">PINFLIX</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Media Hub</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-1">
          {DESKTOP_NAV.map((item) => {
            const match = "match" in item ? item.match : item.to;
            const active = item.exact ? pathname === match : pathname.startsWith(match);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  "tv-focus flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                  active
                    ? "bg-white text-fg shadow-sm ring-1 ring-border"
                    : "text-muted hover:bg-white/80 hover:text-fg",
                )}
              >
                <Icon className={cn("size-[18px]", active && "text-brand")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-brand">
            <Clapperboard className="size-4" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Pinflix Web App</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Responsive playback for desktop, TV browsers, tablets and mobile.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-border bg-white/92 backdrop-blur-xl">
          <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="tv-focus flex items-center gap-2 rounded-xl lg:hidden"
              aria-label="Pinflix home"
            >
              <LogoMark className="size-7 text-brand" />
              <span className="text-[14px] font-black tracking-[0.08em]">PINFLIX</span>
            </Link>

            {entertainmentListing ? (
              <form
                action="/entertainment"
                method="get"
                className="ml-auto flex h-11 w-full max-w-2xl items-center gap-2.5 rounded-2xl border border-border bg-elevated px-4 shadow-sm lg:ml-0"
              >
                <Search className="size-4 text-muted" />
                <input
                  type="search"
                  name="q"
                  placeholder="Search movies, TV shows, animation…"
                  className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
                />
              </form>
            ) : (
              <Link
                href="/search"
                className="tv-focus ml-auto hidden h-11 w-full max-w-2xl items-center gap-2.5 rounded-2xl border border-border bg-elevated px-4 text-sm text-muted shadow-sm hover:border-border-strong hover:bg-white lg:ml-0 md:flex"
                aria-label="Search Pinflix"
              >
                <Search className="size-4" />
                <span className="truncate">Search channels, countries and content…</span>
              </Link>
            )}

            <span
              className="ml-auto hidden h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-muted shadow-sm sm:inline-flex lg:ml-0"
              title="Interface language"
            >
              <Languages className="size-3.5" />
              EN
            </span>

            <Link
              href="/saved"
              className={cn(
                "tv-focus hidden size-10 items-center justify-center rounded-xl border border-border bg-white shadow-sm sm:flex",
                pathname.startsWith("/saved") ? "text-brand" : "text-muted hover:text-fg",
              )}
              aria-label="Saved"
            >
              <Bookmark className="size-4" />
            </Link>

            {!entertainmentListing ? (
              <Link
                href="/search"
                className="tv-focus flex size-10 items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-fg md:hidden"
                aria-label="Search"
              >
                <Search className="size-5" />
              </Link>
            ) : null}
          </div>
        </header>

        <div className="min-h-[calc(100dvh-68px)] pb-16 md:pb-0">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/96 shadow-[0_-8px_24px_rgba(15,23,42,.06)] backdrop-blur-xl md:hidden">
        <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {MOBILE_NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  href={item.to}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                    active ? "font-semibold text-brand" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.3 : 1.8} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

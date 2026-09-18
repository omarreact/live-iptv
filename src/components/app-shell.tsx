"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Film, House, Search } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/browse", label: "Browse", icon: Compass, exact: false },
  { to: "/entertainment", label: "Movies", icon: Film, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
  { to: "/saved", label: "Saved", icon: Bookmark, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const watching = pathname.startsWith("/watch/");

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      {!watching ? (
        <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-5 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="tv-focus flex items-center gap-2 rounded-md" aria-label="Pinflix home">
              <LogoMark className="size-7" />
              <span className="text-[15px] font-bold tracking-[0.075em]">PINFLIX</span>
            </Link>

            <nav className="hidden items-center gap-5 md:flex">
              {NAV.filter(
                (item) => item.to === "/" || item.to === "/browse" || item.to === "/entertainment",
              ).map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    className={cn(
                      "tv-focus rounded-md px-1 py-1 text-sm transition-colors",
                      active ? "font-semibold text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/search"
              className="tv-focus ml-auto hidden h-10 w-full max-w-[420px] items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm text-muted hover:border-border-strong hover:text-fg md:flex"
              aria-label="Search Pinflix"
            >
              <Search className="size-4" />
              <span className="truncate">Search Pinflix…</span>
            </Link>

            <Link
              href="/saved"
              className={cn(
                "tv-focus hidden h-10 items-center gap-2 rounded-lg px-3 text-sm md:flex",
                pathname.startsWith("/saved") ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              <Bookmark className="size-4" />
              Saved
            </Link>

            <Link
              href="/search"
              className="tv-focus ml-auto flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg md:hidden"
              aria-label="Search"
            >
              <Search className="size-5" />
            </Link>
          </div>
        </header>
      ) : null}

      <div className={cn("flex-1", !watching && "pb-16 md:pb-0")}>{children}</div>

      {!watching ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/96 backdrop-blur-sm md:hidden">
          <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                      active ? "font-medium text-brand" : "text-muted",
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
      ) : null}
    </div>
  );
}

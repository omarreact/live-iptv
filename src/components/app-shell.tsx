"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, House, Search } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/browse", label: "Browse", icon: Compass, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
  { to: "/saved", label: "Saved", icon: Bookmark, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const watching = pathname.startsWith("/watch/");

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      {!watching ? (
        <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1320px] items-center px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark className="size-8" />
              <span className="text-base font-bold tracking-[0.08em]">PINFLIX</span>
            </Link>

            <nav className="ml-10 hidden items-center gap-6 md:flex">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    className={cn(
                      "text-sm transition-colors",
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
              className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg md:hidden"
              aria-label="Search"
            >
              <Search className="size-5" />
            </Link>
          </div>
        </header>
      ) : null}

      <div className={cn("flex-1", !watching && "pb-16 md:pb-0")}>{children}</div>

      {!watching ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur md:hidden">
          <ul className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                      active ? "font-medium text-fg" : "text-muted",
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

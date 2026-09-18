"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, House, Search } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/browse", label: "Explore", icon: Compass, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
  { to: "/saved", label: "My TV", icon: Bookmark, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const watching = pathname.startsWith("/watch/");

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      {!watching ? (
        <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-[62px] max-w-[1480px] items-center gap-4 px-4 sm:h-[70px] sm:px-6 lg:px-10">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5 text-fg">
              <LogoMark className="size-8 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-[17px] font-black tracking-[0.13em]">PINFLIX</span>
              <span className="hidden items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand sm:inline-flex">
                <span className="size-1.5 rounded-full bg-brand live-dot" />
                Live
              </span>
            </Link>

            <nav className="ml-5 hidden items-center gap-1 rounded-full border border-border bg-surface/70 p-1 md:flex">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-fg text-bg shadow-sm"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/search"
                className="hidden h-10 items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-fg sm:inline-flex"
              >
                <Search className="size-4" />
                <span className="hidden lg:inline">Find channels</span>
              </Link>
              <Link
                href="/saved"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-surface/70 text-muted transition-all hover:border-border-strong hover:bg-elevated hover:text-fg"
                aria-label="Saved channels"
              >
                <Bookmark className="size-4" />
              </Link>
            </div>
          </div>
        </header>
      ) : null}

      <div className={cn("flex-1", !watching && "pb-[76px] md:pb-0")}>{children}</div>

      {!watching ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 backdrop-blur-2xl md:hidden">
          <ul className="grid grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    className={cn(
                      "relative flex h-[66px] flex-col items-center justify-center gap-1.5 text-[11px] font-medium transition-colors",
                      active ? "text-fg" : "text-muted",
                    )}
                  >
                    {active ? (
                      <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand" />
                    ) : null}
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-xl transition-colors",
                        active && "bg-brand/12 text-brand",
                      )}
                    >
                      <Icon className="size-[19px]" strokeWidth={active ? 2.4 : 1.9} />
                    </span>
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

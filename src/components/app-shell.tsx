import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, Compass, House, Search } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/browse", label: "Guide", icon: Compass, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
  { to: "/saved", label: "Saved", icon: Bookmark, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const watching = pathname.startsWith("/watch/");

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      {!watching ? (
        <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-8">
            <Link to="/" className="flex items-center gap-2 text-fg">
              <LogoMark className="size-6" />
              <span className="font-display text-xl tracking-tight">Aether</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex h-11 items-center rounded-md px-3 text-sm transition-colors duration-150",
                      active ? "text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      ) : null}

      <div className={cn("flex-1", !watching && "pb-20 md:pb-0")}>{children}</div>

      {!watching ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-md md:hidden">
          <ul className="grid grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-1 text-[11px]",
                      active ? "text-fg" : "text-muted",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
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

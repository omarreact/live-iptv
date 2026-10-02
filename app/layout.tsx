import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "../src/styles.css";

export const metadata: Metadata = {
  title: {
    default: "Live IPTV",
    template: "%s · Live IPTV",
  },
  description: "A fast live-TV browser with automatic source fallback.",
  applicationName: "Live IPTV",
};

export const viewport: Viewport = {
  themeColor: "#080b12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/" aria-label="Live IPTV home">
              <span className="brand-mark">▶</span>
              <span>Live IPTV</span>
            </Link>
            <nav className="top-nav" aria-label="Primary navigation">
              <Link href="/">Live TV</Link>
              <Link href="/category/bangla">Bangla</Link>
              <Link href="/category/news">News</Link>
              <Link href="/category/sports">Sports</Link>
            </nav>
            <form className="header-search" action="/search">
              <label className="sr-only" htmlFor="site-search">Search channels</label>
              <input id="site-search" name="q" type="search" placeholder="Search channels" autoComplete="off" />
              <button type="submit">Search</button>
            </form>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>Live IPTV indexes external streams. Availability depends on the upstream broadcaster or provider.</p>
        </footer>
      </body>
    </html>
  );
}

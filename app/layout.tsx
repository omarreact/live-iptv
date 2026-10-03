import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "../src/styles.css";

export const metadata: Metadata = {
  title: { default: "Pinflix TV", template: "%s · Pinflix TV" },
  description: "Pinflix TV — live television with fast search and automatic stream fallback.",
  applicationName: "Pinflix TV",
};

export const viewport: Viewport = { themeColor: "#030305", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/" aria-label="Pinflix TV home">
              <span className="brand-mark">▶</span>
              <span><b>PINFLIX</b> <em>TV</em></span>
            </Link>
            <nav className="top-nav" aria-label="Primary navigation">
              <Link href="/">Live TV</Link>
              <Link href="/category/bangla">Bangla</Link>
              <Link href="/category/news">News</Link>
              <Link href="/category/sports">Sports</Link>
            </nav>
            <form className="header-search" action="/search">
              <label className="sr-only" htmlFor="site-search">Search live channels</label>
              <input id="site-search" name="q" type="search" placeholder="Search live channels…" autoComplete="off" />
              <button type="submit">Search</button>
            </form>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <strong>Pinflix TV</strong>
          <p>Live-TV player and catalog. Stream availability depends on the upstream broadcaster or authorized provider.</p>
        </footer>
      </body>
    </html>
  );
}
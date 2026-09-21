import type { Metadata, Viewport } from "next";
import "../src/styles.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "Pinflix — Watch the world live",
    template: "%s · Pinflix",
  },
  description:
    "Watch live TV and browse movies, TV series, and animation with a fast, mobile-first Pinflix experience.",
  applicationName: "Pinflix",
  keywords: [
    "live TV",
    "IPTV",
    "public television",
    "world TV",
    "live channels",
    "movies",
    "TV series",
    "animation",
    "Pinflix",
  ],
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pinflix.pincodeit.com"),
  openGraph: {
    type: "website",
    siteName: "Pinflix",
    title: "Pinflix — Watch the world live",
    description:
      "Watch live TV and browse movies, TV series, and animation on Pinflix.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pinflix — Watch the world live",
    description:
      "Watch live TV and browse movies, TV series, and animation on Pinflix.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A0B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-fg antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

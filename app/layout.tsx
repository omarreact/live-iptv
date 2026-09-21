import type { Metadata, Viewport } from "next";
import "../src/styles.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "Pinflix — Watch the world live",
    template: "%s · Pinflix",
  },
  description:
    "Watch public live television from around the world. Find a channel, press play, and watch.",
  applicationName: "Pinflix",
  keywords: ["live TV", "IPTV", "public television", "world TV", "live channels", "Pinflix"],
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pinflix.pincodeit.com"),
  openGraph: {
    type: "website",
    siteName: "Pinflix",
    title: "Pinflix — Watch the world live",
    description: "The simplest way to find and watch public live television from around the world.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pinflix — Watch the world live",
    description: "The simplest way to find and watch public live television from around the world.",
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

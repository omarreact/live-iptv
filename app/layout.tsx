import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../src/styles.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "Pinflix — Live TV",
    template: "%s · Pinflix",
  },
  description: "Watch public live television from around the world on Pinflix.",
  applicationName: "Pinflix",
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://iptv.pincodeit.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Pinflix",
    title: "Pinflix — Live TV",
    description: "Watch public live television from around the world on Pinflix.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pinflix — Live TV",
    description: "Watch public live television from around the world on Pinflix.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-fg antialiased">
        <AppShell>{children}</AppShell>
        <SpeedInsights />
      </body>
    </html>
  );
}

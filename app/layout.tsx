import type { Metadata, Viewport } from "next";
import "../src/styles.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "Aether — Live TV",
    template: "%s · Aether",
  },
  description: "Live television from every country — news, sports, film, and more.",
  icons: {
    icon: "/favicon.svg",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://iptv.pincodeit.com"),
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
      </body>
    </html>
  );
}

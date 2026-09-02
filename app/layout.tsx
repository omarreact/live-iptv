import type { Metadata, Viewport } from "next";
import "../src/styles.css";
import { AppShell } from "@/components/app-shell";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";

export const metadata: Metadata = {
  title: "Aether",
  description: "Live television from every country — news, sports, film, and more.",
  icons: {
    icon: "/favicon.svg",
    apple: "/__grok/icon-180.png",
  },
  manifest: "/__grok/manifest.webmanifest",
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
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

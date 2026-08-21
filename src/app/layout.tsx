import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { RoleProvider } from "@/lib/auth/RoleContext";

export const metadata: Metadata = {
  title: "Jerk & Chill Ops",
  description: "Jerk & Chill restaurant operations app — recipes, stock, checklists, planner, notices.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "J&C Ops",
  },
  // Zalo verifies ownership of a domain or URL prefix by fetching the page and
  // looking for this tag. Emitting it site-wide means any prefix under this
  // domain verifies, rather than needing a separate file per URL — and the
  // /api/zalo/callback prefix in particular is an API route that answers with a
  // redirect, so a crawler would never find a tag there otherwise.
  other: {
    "zalo-platform-site-verification": "KkI46RAL1nXiuhOKYySC7NxIkI6If6DuC30m",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#003295",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RoleProvider>{children}</RoleProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

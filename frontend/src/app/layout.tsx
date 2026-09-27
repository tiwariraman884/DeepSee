import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/theme-provider";
import { SettingsProvider } from "@/lib/settings/store";
import { RegionProvider } from "@/lib/settings/region-context";
import { ProfileProvider } from "@/lib/profile/store";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://deepsea-guardian.example.org"),
  title: {
    default: "DeepSea Guardian — AI-Powered Ocean Monitoring",
    template: "%s · DeepSea Guardian",
  },
  description:
    "An AI-powered mission control platform that monitors, predicts, and protects deep-sea ecosystems through intelligent environmental analytics.",
  applicationName: "DeepSea Guardian",
  keywords: [
    "ocean monitoring",
    "marine pollution",
    "biodiversity",
    "AI",
    "deep sea",
    "conservation",
  ],
  authors: [{ name: "DeepSea Guardian" }],
  openGraph: {
    type: "website",
    siteName: "DeepSea Guardian",
    title: "DeepSea Guardian — AI-Powered Ocean Monitoring",
    description: "Protecting the Ocean with Artificial Intelligence.",
    url: "https://deepsea-guardian.example.org",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "DeepSea Guardian" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeepSea Guardian — AI-Powered Ocean Monitoring",
    description: "Protecting the Ocean with Artificial Intelligence.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://deepsea-guardian.example.org",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://b.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://c.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="min-h-screen bg-primary font-sans text-text-primary antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        <MotionConfig reducedMotion="user">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <SettingsProvider>
              <RegionProvider>
                <ProfileProvider>
                  <ToastProvider>
                    <PageTransition>{children}</PageTransition>
                  </ToastProvider>
                </ProfileProvider>
              </RegionProvider>
            </SettingsProvider>
          </ThemeProvider>
        </MotionConfig>
      </body>
    </html>
  );
}

import Link from "next/link";
import { Waves, BookOpen, ArrowRight, Search, FileText, HelpCircle } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Documentation",
  description:
    "Complete documentation for DeepSea Guardian — platform overview, getting started guides, dashboard, map, AI assistant, drone monitoring, risk analysis, and API reference.",
  path: "/documentation",
});

const sections = [
  {
    title: "Getting Started",
    icon: BookOpen,
    articles: [
      { title: "Platform Overview", href: "#overview" },
      { title: "Creating Your Account", href: "#account" },
      { title: "Dashboard Quick Start", href: "#dashboard" },
      { title: "Navigation Basics", href: "#navigation" },
    ],
  },
  {
    title: "Core Features",
    icon: FileText,
    articles: [
      { title: "Ocean Dashboard Guide", href: "#dashboard-guide" },
      { title: "Interactive Map Guide", href: "#map-guide" },
      { title: "AI Assistant Guide", href: "#assistant-guide" },
      { title: "Drone Monitoring", href: "#drones" },
      { title: "Risk Analysis", href: "#risk" },
    ],
  },
  {
    title: "Data & API",
    icon: Search,
    articles: [
      { title: "Data Sources", href: "#data-sources" },
      { title: "API Overview", href: "#api" },
      { title: "Authentication", href: "#auth" },
      { title: "Rate Limits", href: "#rate-limits" },
    ],
  },
  {
    title: "Resources",
    icon: HelpCircle,
    articles: [
      { title: "Best Practices", href: "#best-practices" },
      { title: "Glossary", href: "#glossary" },
      { title: "FAQ", href: "/faq" },
      { title: "Contact Support", href: "/contact" },
    ],
  },
];

export default function DocumentationPage() {
  return (
    <main id="main-content" className="overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-500/20 text-ocean-300">
              <Waves className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-white">DeepSea Guardian</span>
          </Link>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <BookOpen className="h-3.5 w-3.5" /> Documentation
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Platform{" "}
            <span className="gradient-text">Documentation</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Comprehensive guides, API references, and best practices for using DeepSea Guardian to protect our oceans.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2">
            {sections.map((s) => (
              <div key={s.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{s.title}</h2>
                </div>
                <ul className="mt-4 space-y-2">
                  {s.articles.map((a) => (
                    <li key={a.title}>
                      <Link href={a.href} className="text-sm text-ocean-200/60 hover:text-ocean-100">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

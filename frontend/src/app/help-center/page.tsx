import Link from "next/link";
import { Waves, BookOpen, Search, MessageSquare, FileText, HelpCircle } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Help Center",
  description:
    "DeepSea Guardian Help Center — find answers, guides, and support for our AI-powered ocean monitoring platform. Documentation, FAQs, and contact support.",
  path: "/help-center",
});

const categories = [
  { icon: BookOpen, title: "Getting Started", links: ["Platform Overview", "Creating an Account", "Dashboard Basics", "Navigation Guide"] },
  { icon: Search, title: "Features", links: ["Ocean Map", "Pollution Detection", "AI Assistant", "Drone Monitoring", "Reports"] },
  { icon: FileText, title: "Account & Billing", links: ["Managing Your Account", "Subscription Plans", "Invoice & Payments", "Team Management"] },
  { icon: MessageSquare, title: "Technical Support", links: ["Troubleshooting", "API Documentation", "Integration Guide", "System Status"] },
];

export default function HelpCenterPage() {
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
            <HelpCircle className="h-3.5 w-3.5" /> Help Center
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            How can we{" "}
            <span className="gradient-text">help?</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Search our knowledge base or browse categories below.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {categories.map((cat) => (
              <div key={cat.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <cat.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{cat.title}</h2>
                </div>
                <ul className="mt-4 space-y-2">
                  {cat.links.map((link) => (
                    <li key={link}>
                      <Link href="#" className="text-sm text-ocean-200/60 hover:text-ocean-100">{link}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Still need help?</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Our support team is available 24/7 for enterprise customers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
              Contact Support
            </Link>
            <Link href="/report-issue" className="inline-flex items-center gap-2 rounded-xl border border-ocean-500/30 px-6 py-3 text-sm font-semibold text-ocean-100 hover:bg-ocean-500/10">
              Report an Issue
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

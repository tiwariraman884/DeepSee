import Link from "next/link";
import { Waves, Cookie, Settings, BarChart3, Shield } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Cookie Policy",
  description:
    "DeepSea Guardian cookie policy — learn about essential, analytics, performance, preference, and third-party cookies. Manage your cookie preferences and understand how we use cookies.",
  path: "/cookie-policy",
});

const cookies = [
  { type: "Essential", icon: Shield, desc: "Required for the platform to function. Enable authentication, session management, and security. Cannot be disabled." },
  { type: "Analytics", icon: BarChart3, desc: "Help us understand how visitors interact with the platform. All data is anonymized and aggregated." },
  { type: "Performance", icon: Settings, desc: "Remember your preferences and settings to provide a faster, more personalized experience." },
  { type: "Third-Party", icon: Cookie, desc: "Set by trusted partners for support, security, and integrated services. Subject to third-party privacy policies." },
];

export default function CookiePolicyPage() {
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
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <Cookie className="h-3.5 w-3.5" /> Cookie Policy
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Cookie{" "}
            <span className="gradient-text">Policy</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ocean-200/70">
            Last updated: July 2026. This policy explains how DeepSea Guardian uses cookies and similar technologies.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          {cookies.map((c) => (
            <div key={c.type} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                  <c.icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">{c.type}</h2>
              </div>
              <p className="mt-2 text-sm text-ocean-200/70">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

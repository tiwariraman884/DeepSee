import Link from "next/link";
import { Waves, AlertTriangle, FileText, Send } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Report an Issue",
  description:
    "Report bugs, security issues, or data inaccuracies on DeepSea Guardian. Help us improve the platform for ocean conservation.",
  path: "/report-issue",
});

export default function ReportIssuePage() {
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
            <AlertTriangle className="h-3.5 w-3.5" /> Report an Issue
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Help us{" "}
            <span className="gradient-text">improve</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Found a bug, data inaccuracy, or security concern? Let us know and we&apos;ll investigate immediately.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <form className="glass rounded-2xl p-8 space-y-6">
            <div>
              <label htmlFor="type" className="text-xs text-ocean-200/60">Issue Type</label>
              <select id="type" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400">
                <option>Bug / Error</option>
                <option>Data Inaccuracy</option>
                <option>Security Vulnerability</option>
                <option>Performance Issue</option>
                <option>Feature Request</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="url" className="text-xs text-ocean-200/60">Page URL</label>
              <input id="url" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" placeholder="https://deepseaguardian.org/..." />
            </div>
            <div>
              <label htmlFor="description" className="text-xs text-ocean-200/60">Description</label>
              <textarea id="description" rows={5} className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" placeholder="Describe the issue..." />
            </div>
            <div>
              <label htmlFor="email" className="text-xs text-ocean-200/60">Your Email</label>
              <input id="email" type="email" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
              <Send className="h-4 w-4" /> Submit Report
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

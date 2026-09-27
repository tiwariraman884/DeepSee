import Link from "next/link";
import { Waves, MessageSquare, Star } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Feedback",
  description:
    "Share feedback with DeepSea Guardian. Help us improve our AI-powered ocean monitoring platform with your suggestions, ideas, and feature requests.",
  path: "/feedback",
});

export default function FeedbackPage() {
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
            <MessageSquare className="h-3.5 w-3.5" /> Feedback
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Your voice{" "}
            <span className="gradient-text">matters</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Help us shape the future of ocean intelligence. Share your ideas, report issues, or request features.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <form className="glass rounded-2xl p-8 space-y-6">
            <div>
              <label htmlFor="type" className="text-xs text-ocean-200/60">Feedback Type</label>
              <select id="type" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400">
                <option>Feature Request</option>
                <option>Bug Report</option>
                <option>General Feedback</option>
                <option>Data Issue</option>
              </select>
            </div>
            <div>
              <label htmlFor="feedback" className="text-xs text-ocean-200/60">Your Feedback</label>
              <textarea id="feedback" rows={6} className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" placeholder="Tell us what you think..." />
            </div>
            <div>
              <label htmlFor="email" className="text-xs text-ocean-200/60">Email (optional)</label>
              <input id="email" type="email" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
              <Star className="h-4 w-4" /> Submit Feedback
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

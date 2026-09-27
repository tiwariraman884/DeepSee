import Link from "next/link";
import { Waves, Accessibility, Keyboard, Eye, Monitor, Mail } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Accessibility",
  description:
    "DeepSea Guardian accessibility statement — WCAG 2.2 AA compliant. Learn about our commitment to keyboard navigation, color contrast, screen readers, reduced motion, and inclusive design.",
  path: "/accessibility",
});

const commitments = [
  { icon: Keyboard, title: "Keyboard Navigation", desc: "All interactive elements are accessible via keyboard. Focus indicators are clearly visible. Logical tab order throughout the platform." },
  { icon: Eye, title: "Color Contrast", desc: "Text and interactive elements meet WCAG AA contrast ratios (4.5:1 minimum). Critical information is never conveyed by color alone." },
  { icon: Monitor, title: "Reduced Motion", desc: "We respect the prefers-reduced-motion setting. Animations and transitions are minimized or disabled based on user preference." },
  { icon: Accessibility, title: "Screen Readers", desc: "Semantic HTML, ARIA labels, and live regions ensure compatibility with screen readers. All charts and visualizations include text alternatives." },
];

export default function AccessibilityPage() {
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
            <Accessibility className="h-3.5 w-3.5" /> Accessibility
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Inclusive by{" "}
            <span className="gradient-text">design</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            DeepSea Guardian is committed to WCAG 2.2 AA compliance. Our platform is designed to be usable by everyone, regardless of ability.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Our Commitments</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {commitments.map((c) => (
              <div key={c.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white">{c.title}</h3>
                </div>
                <p className="mt-2 text-sm text-ocean-200/70">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Accessibility Feedback</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            We&apos;re continuously improving. If you encounter accessibility barriers, please let us know.
          </p>
          <a href="mailto:accessibility@deepseaguardian.org" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
            <Mail className="h-4 w-4" /> Contact Accessibility Team
          </a>
        </div>
      </section>
    </main>
  );
}

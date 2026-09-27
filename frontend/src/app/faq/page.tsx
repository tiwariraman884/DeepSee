import Link from "next/link";
import { Waves, HelpCircle, ChevronDown, MessageSquare } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "FAQ",
  description:
    "Frequently asked questions about DeepSea Guardian — privacy, AI, maps, sensors, accuracy, security, data sources, accounts, and marine life monitoring.",
  path: "/faq",
});

const faqs = [
  { q: "What is DeepSea Guardian?", a: "DeepSea Guardian is an AI-powered mission control platform that monitors, predicts, and protects deep-sea ecosystems using satellite imagery, underwater drones, IoT sensors, and advanced analytics." },
  { q: "Who can use DeepSea Guardian?", a: "Marine researchers, government agencies, NGOs, universities, coastal authorities, climate scientists, and ocean conservation teams worldwide." },
  { q: "How does the AI detect pollution?", a: "We train computer vision models on multi-spectral satellite imagery and drone footage to identify plastic accumulation, oil spills, ghost nets, and illegal dumping. The system processes imagery in near real-time and generates alerts." },
  { q: "What satellite data do you use?", a: "We ingest data from Sentinel-2, Landsat-8/9, MODIS, and commercial high-resolution providers. Data is processed through our AI pipeline to extract pollution, temperature, and chlorophyll indicators." },
  { q: "How accurate is the AI?", a: "Our models achieve 94%+ accuracy for species identification and 87% accuracy for coral bleaching prediction. Accuracy varies by data quality, region, and environmental conditions." },
  { q: "What types of sensors do you support?", a: "We integrate CTD sensors, pH sensors, dissolved oxygen meters, acoustic Doppler current profilers (ADCP), and custom IoT devices via MQTT and REST APIs." },
  { q: "Is my data secure?", a: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We implement role-based access control, audit logging, and regular security assessments." },
  { q: "Do you comply with GDPR?", a: "Yes. DeepSea Guardian is fully GDPR compliant. We provide data portability, right to erasure, and transparent data processing policies." },
  { q: "Can I export my data?", a: "Yes. All users can export their dashboard data, reports, and configurations in CSV, PDF, and GeoJSON formats via the Settings page." },
  { q: "What is the Digital Twin Ocean?", a: "A 3D simulation model of ocean systems that allows conservationists to test interventions, model pollution spread, and forecast ecosystem changes before deploying resources." },
  { q: "How does the Drone Command Center work?", a: "Our platform tracks autonomous underwater and surface drones in real-time, displaying battery levels, mission status, sensor payloads, and flight paths on an interactive map." },
  { q: "What is the AI Assistant?", a: "A natural language interface that answers questions about ocean data. Ask about pollution trends, species status, risk levels, and receive instant, cited answers." },
  { q: "Do you offer an API?", a: "Yes. Our REST API allows programmatic access to ocean health data, pollution alerts, species records, and sensor readings. API documentation is available to registered users." },
  { q: "How do I report a bug?", a: "Use the &apos;Report an Issue&apos; link in the footer or email support@deepseaguardian.org. We aim to respond within 24 hours." },
  { q: "What browsers are supported?", a: "DeepSea Guardian supports Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. We recommend using the latest version for optimal performance." },
  { q: "Is there a mobile app?", a: "A mobile app is on our roadmap for Q3 2026. Currently, the platform is fully responsive and works on mobile browsers." },
  { q: "How often is data updated?", a: "Dashboard data refreshes every 5 minutes. Satellite imagery is updated daily. Drone and sensor data streams in real-time where connectivity allows." },
  { q: "Can I use DeepSea Guardian offline?", a: "Limited offline mode is available for previously loaded dashboards. Full functionality requires an internet connection for real-time data and AI processing." },
  { q: "What is the pricing model?", a: "We offer tiered pricing: Free for researchers and NGOs, Pro for government agencies, and Enterprise for large institutions. Contact us for custom plans." },
  { q: "How can I partner with DeepSea Guardian?", a: "We collaborate with research institutions, NGOs, and government agencies. Email research@deepseaguardian.org to discuss partnership opportunities." },
  { q: "Where is DeepSea Guardian headquartered?", a: "We have offices in San Francisco, Lisbon, and Singapore, with a distributed remote-first team across 12 countries." },
  { q: "Do you offer training?", a: "Yes. We provide onboarding sessions, video tutorials, documentation, and dedicated support for enterprise customers." },
];

export default function FAQPage() {
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
            <HelpCircle className="h-3.5 w-3.5" /> Frequently Asked Questions
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Got{" "}
            <span className="gradient-text">questions?</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Find answers to common questions about DeepSea Guardian, our technology, data, and platform.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4">
            {faqs.map((item, i) => (
              <details key={i} className="glass rounded-2xl p-6 group">
                <summary className="flex cursor-pointer items-center justify-between text-left font-medium text-white">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-ocean-200/60 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-ocean-200/70">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Still have questions?</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Can&apos;t find what you&apos;re looking for? Our support team is here to help.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
              Contact Support <MessageSquare className="h-4 w-4" />
            </Link>
            <Link href="/help-center" className="inline-flex items-center gap-2 rounded-xl border border-ocean-500/30 px-6 py-3 text-sm font-semibold text-ocean-100 hover:bg-ocean-500/10">
              Visit Help Center
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

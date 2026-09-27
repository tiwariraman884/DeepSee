import Link from "next/link";
import { Waves, ArrowRight, Globe2, Satellite, Cpu, Smartphone, Users, Code2 } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Roadmap",
  description:
    "Explore DeepSea Guardian&apos;s product roadmap — upcoming features include drone swarms, satellite integration, predictive climate models, citizen science tools, and an open API.",
  path: "/roadmap",
});

const phases = [
  {
    phase: "Current Version",
    version: "v1.0",
    status: "Released",
    items: [
      { title: "Ocean Dashboard", desc: "Real-time KPI monitoring and visualization." },
      { title: "Interactive Map", desc: "Pollution heatmaps, drone tracking, sensor layers." },
      { title: "AI Assistant", desc: "Natural language queries with data citations." },
      { title: "Pollution Detection", desc: "Computer vision models for plastic, oil, ghost nets." },
      { title: "Biodiversity Monitoring", desc: "Species identification and population tracking." },
    ],
  },
  {
    phase: "Q3 2026",
    version: "v1.5",
    status: "In Development",
    items: [
      { title: "Drone Swarms", desc: "Coordinated autonomous drone fleets for large-area coverage." },
      { title: "Satellite Integration", desc: "Direct ingestion of Sentinel-2, Landsat, and MODIS data." },
      { title: "Mobile App", desc: "iOS and Android apps for field researchers and conservationists." },
      { title: "Advanced Reports", desc: "Custom report builder with regulatory templates." },
    ],
  },
  {
    phase: "Q4 2026",
    version: "v2.0",
    status: "Planned",
    items: [
      { title: "Predictive Climate Models", desc: "Long-term ocean health forecasting with climate scenarios." },
      { title: "Citizen Science", desc: "Public participation tools for beach cleanups and species sightings." },
      { title: "Open API", desc: "RESTful API for third-party integrations and research workflows." },
      { title: "Global Expansion", desc: "Regional deployments in Asia-Pacific, Africa, and South America." },
    ],
  },
  {
    phase: "2027+",
    version: "v3.0",
    status: "Vision",
    items: [
      { title: "Autonomous Response", desc: "AI-triggered alert systems connected to intervention teams." },
      { title: "Blockchain Verification", desc: "Immutable audit trails for conservation impact and funding." },
      { title: "Global Sensor Network", desc: "10,000+ IoT sensors across all major ocean basins." },
      { title: "UN Integration", desc: "Direct data feeds to UN Ocean Decade and SDG reporting." },
    ],
  },
];

export default function RoadmapPage() {
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
            <Globe2 className="h-3.5 w-3.5" /> Roadmap
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Building the future of{" "}
            <span className="gradient-text">ocean intelligence</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Our vision extends far beyond monitoring. Here&apos;s how we&apos;re evolving the platform.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="space-y-12">
            {phases.map((p) => (
              <div key={p.version} className="glass rounded-2xl p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">{p.phase}</h2>
                  <span className="rounded-full border border-ocean-500/20 bg-ocean-500/10 px-3 py-1 text-xs text-ocean-200">{p.version}</span>
                  <span className={`rounded-full px-3 py-1 text-xs ${p.status === "Released" ? "bg-biolum-500/15 text-biolum-400" : p.status === "In Development" ? "bg-ocean-500/15 text-ocean-300" : p.status === "Planned" ? "bg-coral-500/15 text-coral-400" : "bg-ocean-500/5 text-ocean-200/50"}`}>
                    {p.status}
                  </span>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {p.items.map((item) => (
                    <div key={item.title} className="rounded-xl border border-ocean-500/10 bg-abyss-950/40 p-4">
                      <h3 className="font-medium text-white">{item.title}</h3>
                      <p className="mt-1 text-sm text-ocean-200/60">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Shape the future with us</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Your feedback directly influences our roadmap. Join the community and help us build the ocean intelligence platform of the future.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/feedback" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
              Share Feedback <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/community" className="inline-flex items-center gap-2 rounded-xl border border-ocean-500/30 px-6 py-3 text-sm font-semibold text-ocean-100 hover:bg-ocean-500/10">
              Join Community
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { Waves, Target, Eye, Users, ArrowRight, Globe2, Radio, Brain, Map, Shield, BarChart3 } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "About DeepSea Guardian",
  description:
    "Learn about DeepSea Guardian — an AI-powered mission control platform protecting deep-sea ecosystems through intelligent environmental analytics, satellite imagery, underwater drones, and IoT sensors.",
  path: "/about",
});

const values = [
  {
    icon: Target,
    title: "Mission",
    text: "Empower environmental organizations and governments with real-time ocean intelligence for early detection, rapid response, and long-term conservation planning.",
  },
  {
    icon: Eye,
    title: "Vision",
    text: "Build the world's most intelligent and accessible platform for protecting deep-sea ecosystems through AI-powered monitoring and predictive analytics.",
  },
  {
    icon: Users,
    title: "For Everyone",
    text: "Built for government agencies, marine researchers, NGOs, universities, and international organizations like UNEP, UNESCO, and WWF.",
  },
];

const stats = [
  { value: "72", label: "Ocean Health Index" },
  { value: "8", label: "Pollution Hotspots Tracked" },
  { value: "10", label: "Species Monitored" },
  { value: "6", label: "Active Drones" },
];

const techStack = [
  { icon: Globe2, title: "Satellite Imagery", desc: "Multi-spectral and SAR satellite data for large-scale ocean monitoring." },
  { icon: Radio, title: "Underwater Drones", desc: "Autonomous underwater vehicles (AUVs) and surface drones for real-time data collection." },
  { icon: Brain, title: "AI & Machine Learning", desc: "Deep learning models for pollution detection, species identification, and risk prediction." },
  { icon: Map, title: "GIS Mapping", desc: "Geographic Information Systems for spatial analysis, heatmaps, and environmental modeling." },
  { icon: Shield, title: "IoT Sensors", desc: "Distributed sensor networks measuring temperature, salinity, pH, and pollution levels." },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Streaming data pipelines with sub-second latency for mission-critical decisions." },
];

export default function AboutPage() {
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
          <Link href="/dashboard" className="rounded-xl bg-ocean-500 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-400">
            Launch Dashboard
          </Link>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <Waves className="h-3.5 w-3.5" /> About DeepSea Guardian
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Protecting the Ocean with{" "}
            <span className="gradient-text">Artificial Intelligence</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            An AI-powered mission control platform that monitors, predicts, and protects
            deep-sea ecosystems through intelligent environmental analytics and real-time ocean intelligence.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-biolum-400">{s.value}</p>
              <p className="mt-1 text-xs text-ocean-200/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Our Values</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ocean-200/70">
            Guided by science, driven by technology, and committed to preserving the ocean for future generations.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="glass rounded-2xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{v.title}</h3>
                <p className="mt-2 text-sm text-ocean-200/60">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white">Our Technology</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ocean-200/70">
            A unified platform integrating satellite imagery, autonomous drones, IoT sensors, and advanced AI models.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {techStack.map((t) => (
              <div key={t.title} className="glass rounded-2xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-biolum-500/15 text-biolum-400">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{t.title}</h3>
                <p className="mt-2 text-sm text-ocean-200/60">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Join the mission</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Explore live ocean intelligence and start monitoring the deep sea today.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400"
          >
            Enter Mission Control <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

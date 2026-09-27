import Link from "next/link";
import { Waves, ArrowRight, BarChart3, Map, AlertTriangle, Fish, Brain, Bot, Radio, FileBarChart, Globe2, Activity } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Features",
  description:
    "Explore DeepSea Guardian's AI-powered ocean monitoring features: real-time dashboard, interactive maps, pollution detection, biodiversity tracking, risk prediction, and more.",
  path: "/features",
});

const features = [
  {
    icon: BarChart3,
    title: "Ocean Dashboard",
    desc: "Unified command center displaying real-time ocean health scores, active drone missions, pollution hotspots, species counts, and sensor status. Interactive widgets with drill-down analytics and customizable KPI panels.",
    details: ["Real-time data refresh", "Customizable widgets", "Historical trend analysis", "Multi-region comparison"],
  },
  {
    icon: Map,
    title: "Interactive Ocean Map",
    desc: "High-resolution geospatial visualization with pollution heatmaps, drone flight paths, sensor locations, species habitats, and risk zones. Supports multiple basemaps and layer toggles.",
    details: ["Satellite basemaps", "Heatmap overlays", "Drone tracking", "Species distribution"],
  },
  {
    icon: AlertTriangle,
    title: "AI Pollution Detection",
    desc: "Computer vision models trained on satellite imagery to detect plastic accumulation, oil spills, ghost nets, and illegal dumping. Alerts generated within minutes of detection.",
    details: ["Multi-class detection", "Sub-10-minute alerts", "Confidence scoring", "Historical event tracking"],
  },
  {
    icon: Fish,
    title: "Biodiversity Monitoring",
    desc: "Automated species identification from underwater imagery and acoustic data. Track population trends, migration patterns, and habitat health across protected marine areas.",
    details: ["Species classification", "Population trends", "Migration tracking", "Habitat mapping"],
  },
  {
    icon: Brain,
    title: "AI Risk Prediction",
    desc: "Predictive models forecasting coral bleaching events, biodiversity loss, and pollution expansion. Time horizons from 1 day to 5 years with confidence intervals.",
    details: ["Multi-horizon forecasts", "Confidence intervals", "Scenario modeling", "Early warning system"],
  },
  {
    icon: Bot,
    title: "AI Assistant",
    desc: "Natural language interface for querying ocean data. Ask questions about pollution trends, species status, risk levels, and receive instant, cited answers.",
    details: ["Natural language queries", "Data citations", "Context-aware responses", "Multi-language support"],
  },
  {
    icon: Radio,
    title: "Drone Command Center",
    desc: "Real-time monitoring of autonomous underwater and surface drones. Track battery levels, mission status, sensor payloads, and flight paths.",
    details: ["Live tracking", "Mission planning", "Battery monitoring", "Sensor management"],
  },
  {
    icon: Globe2,
    title: "Digital Twin Ocean",
    desc: "3D visualization of ocean systems for simulation and scenario planning. Model the impact of conservation interventions before deploying resources.",
    details: ["3D ocean modeling", "Scenario simulation", "Intervention planning", "Impact forecasting"],
  },
  {
    icon: Activity,
    title: "Time Machine",
    desc: "Visualize ocean changes across time horizons: Today, 1 Month, 6 Months, 1 Year, 5 Years. Understand trends and make data-driven decisions.",
    details: ["Time horizon slider", "Trend visualization", "Comparative analysis", "Export reports"],
  },
  {
    icon: FileBarChart,
    title: "Reports & Analytics",
    desc: "Automated report generation for weekly, monthly, and annual ocean health assessments. Exportable PDFs and CSV datasets for stakeholders and regulators.",
    details: ["Automated reports", "Custom date ranges", "PDF/CSV export", "Stakeholder templates"],
  },
];

export default function FeaturesPage() {
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
            <Waves className="h-3.5 w-3.5" /> Platform Features
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Every tool you need to{" "}
            <span className="gradient-text">protect the ocean</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            From real-time monitoring to predictive analytics, DeepSea Guardian provides a complete toolkit for ocean conservation.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                </div>
                <p className="mt-3 text-sm text-ocean-200/70">{f.desc}</p>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {f.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-xs text-ocean-200/60">
                      <span className="h-1 w-1 rounded-full bg-ocean-400" />
                      {d}
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
          <h2 className="text-2xl font-bold text-white">Ready to explore?</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Start monitoring ocean health, tracking species, and predicting risks with DeepSea Guardian.
          </p>
          <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
            Launch Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

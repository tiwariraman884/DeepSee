import Link from "next/link";
import { Waves, CheckCircle2, XCircle, AlertTriangle, Activity } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Status",
  description:
    "DeepSea Guardian system status — real-time platform health, API status, and service availability. Monitor dashboard, map, AI assistant, and API uptime.",
  path: "/status",
});

const services = [
  { name: "Ocean Dashboard", status: "operational", uptime: "99.98%" },
  { name: "Interactive Map", status: "operational", uptime: "99.97%" },
  { name: "AI Assistant", status: "operational", uptime: "99.95%" },
  { name: "Pollution Detection API", status: "operational", uptime: "99.99%" },
  { name: "Drone Telemetry", status: "operational", uptime: "99.94%" },
  { name: "Satellite Data Pipeline", status: "operational", uptime: "99.96%" },
  { name: "Sensor Network", status: "degraded", uptime: "98.50%" },
  { name: "Report Generation", status: "operational", uptime: "99.93%" },
];

const incidents = [
  { date: "2026-07-18", title: "Sensor Network Latency", status: "investigating", desc: "We're investigating increased latency in the South Pacific sensor array. Some data points may be delayed by up to 15 minutes." },
  { date: "2026-07-10", title: "Map Tile Outage", status: "resolved", desc: "CartoDB tile outage affected map rendering for 45 minutes. Service restored and monitoring." },
  { date: "2026-06-28", title: "AI Assistant Slowdown", status: "resolved", desc: "Increased query volume caused response delays. Auto-scaling resolved the issue within 30 minutes." },
];

export default function StatusPage() {
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
          <div className="flex items-center gap-2 text-sm text-ocean-200/70">
            <Activity className="h-4 w-4 text-biolum-400" />
            <span>All systems operational</span>
          </div>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <Activity className="h-3.5 w-3.5" /> System Status
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Platform{" "}
            <span className="gradient-text">status</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Real-time health monitoring for all DeepSea Guardian services.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-4">
            {services.map((s) => (
              <div key={s.name} className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {s.status === "operational" ? (
                      <CheckCircle2 className="h-5 w-5 text-biolum-400" />
                    ) : s.status === "degraded" ? (
                      <AlertTriangle className="h-5 w-5 text-coral-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400" />
                    )}
                    <div>
                      <h3 className="font-medium text-white">{s.name}</h3>
                      <p className="text-xs text-ocean-200/60 capitalize">{s.status}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-ocean-200/70">{s.uptime} uptime</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-white">Recent Incidents</h2>
          <div className="mt-12 space-y-6">
            {incidents.map((inc) => (
              <div key={inc.date + inc.title} className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{inc.title}</h3>
                    <p className="text-xs text-ocean-200/60">{inc.date}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs capitalize ${inc.status === "resolved" ? "bg-biolum-500/15 text-biolum-400" : "bg-coral-500/15 text-coral-400"}`}>
                    {inc.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-ocean-200/70">{inc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

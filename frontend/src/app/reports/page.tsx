"use client";

import { useEffect, useState } from "react";
import { FileBarChart, Download, Share2, Leaf, Waves, Fish, Plus, Loader2, RotateCcw, ShieldAlert, Eye } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { ConservationMeter } from "@/components/visuals/ConservationMeter";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useSimulatedLoad } from "@/hooks/useSimulatedLoad";
import { useToast } from "@/components/ui/Toast";

const tabs = [
  { id: "weekly", label: "Weekly", icon: FileBarChart },
  { id: "environmental", label: "Environmental", icon: Leaf },
  { id: "health", label: "Ocean Health", icon: Waves },
  { id: "species", label: "Species", icon: Fish },
  { id: "incidents", label: "Incidents", icon: ShieldAlert },
];

const reportsByTab: Record<string, { name: string; date: string; size: string }[]> = {
  weekly: [
    { name: "Weekly Ocean Brief #28", date: "2026-07-18", size: "2.4 MB" },
    { name: "Weekly Ocean Brief #27", date: "2026-07-11", size: "2.1 MB" },
  ],
  environmental: [
    { name: "Environmental Impact Q3", date: "2026-07-15", size: "5.8 MB" },
    { name: "Carbon & Discharge Audit", date: "2026-06-30", size: "3.2 MB" },
  ],
  health: [
    { name: "Ocean Health Index Report", date: "2026-07-10", size: "4.0 MB" },
    { name: "Coral Health Deep Dive", date: "2026-06-22", size: "3.6 MB" },
  ],
  species: [
    { name: "Species Conservation Update", date: "2026-07-12", size: "3.9 MB" },
    { name: "Endangered Stock Assessment", date: "2026-06-18", size: "2.8 MB" },
  ],
};

const previews: Record<string, string> = {
  weekly: "This week recorded 3 new critical pollution sites and a 2-point drop in Caribbean coral health. Drone fleet completed 14 patrol missions covering 665 km².",
  environmental: "Discharge in the Mediterranean exceeded safe thresholds on 4 occasions. Plastic accumulation in the North Pacific Gyre expanded 6% week-over-week.",
  health: "Composite Ocean Health Index stands at 72/100. Water Quality (81) remains the strongest pillar; Coral Health (49) the weakest and requires intervention.",
  species: "10 species tracked; Vaquita population critically low (~10). Conservation progress averaging 45% with reef species showing slow recovery.",
  incidents: "Automated incident reports generated from completed autonomous inspections — evidence-backed, tied to a single inspection record.",
};

interface IncidentRow {
  reportId: string;
  inspectionId: string;
  severity: string | null;
  location: string | null;
  sensorName: string | null;
  generatedAt: string;
}

function IncidentReportsTable() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reports/incidents?limit=50");
        const body = await res.json().catch(() => null);
        if (!cancelled) {
          if (res.ok && Array.isArray(body?.reports)) setRows(body.reports);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const downloadPdf = async (inspectionId: string) => {
    const res = await fetch(`/api/reports/incidents/${encodeURIComponent(inspectionId)}/pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-${inspectionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-secondary/60" />
        ))}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="p-4">
        <EmptyState
          title="Could not load incident reports."
          description="Check that you are logged in and the backend is reachable."
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="No incident reports yet."
          description="Run an Emergency Ocean Scenario to completion — its incident report will appear here."
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Automated incident reports</caption>
        <thead>
          <tr className="text-text-muted">
            <th className="pb-2 pr-2 font-medium">Incident</th>
            <th className="pb-2 pr-2 font-medium">Severity</th>
            <th className="pb-2 pr-2 font-medium">Location</th>
            <th className="pb-2 pr-2 font-medium">Inspection</th>
            <th className="pb-2 pr-2 font-medium">Generated</th>
            <th className="pb-2 pr-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.reportId} className="border-t border-white/10">
              <td className="py-2 pr-2 font-mono font-medium text-text-primary">{r.reportId}</td>
              <td className="py-2 pr-2 text-text-primary">{(r.severity ?? "unknown").toUpperCase()}</td>
              <td className="py-2 pr-2 text-text-muted">{r.location ?? "—"}</td>
              <td className="py-2 pr-2 font-mono text-text-muted">{r.inspectionId}</td>
              <td className="py-2 pr-2 text-text-muted">{r.generatedAt}</td>
              <td className="py-2 pr-2">
                <div className="flex gap-2">
                  <a
                    aria-label={`View ${r.reportId}`}
                    href={`/incident-reports/${encodeURIComponent(r.inspectionId)}`}
                    className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-text-muted hover:bg-white/5"
                  >
                    <Eye className="h-3 w-3" /> View
                  </a>
                  <button
                    aria-label={`Download ${r.reportId} PDF`}
                    onClick={() => downloadPdf(r.inspectionId)}
                    className="flex items-center gap-1 rounded bg-accent/20 px-2 py-1 text-text-primary hover:bg-accent/30"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState("weekly");
  const [modal, setModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { status, retry } = useSimulatedLoad();
  const { success, error: toastError } = useToast();
  const list = reportsByTab[tab] ?? [];

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf", region: tab }),
      });
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();
      setModal(false);
      success(`Report generated · ${data.id}`);
    } catch {
      toastError("Failed to generate report. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <DashboardShell title="Reports & Analytics" subtitle="Generate and share ocean intelligence">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={tabs.map((t) => ({ id: t.id, label: t.label, icon: <t.icon className="h-4 w-4" /> }))}
          active={tab}
          onChange={setTab}
        />
        <Button onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" /> Generate Report
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`${tabs.find((t) => t.id === tab)?.label} Reports`} />
          {tab === "incidents" ? (
            <IncidentReportsTable />
          ) : status === "loading" ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No reports in this category yet."
                description="Generate your first report to populate this view."
                actionLabel="Generate Report"
                onAction={() => setModal(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">{tabs.find((t) => t.id === tab)?.label} reports</caption>
                <thead>
                  <tr className="text-text-muted">
                    <th className="pb-2 pr-2 font-medium">Report</th>
                    <th className="pb-2 pr-2 font-medium">Generated</th>
                    <th className="pb-2 pr-2 font-medium">Size</th>
                    <th className="pb-2 pr-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.name} className="border-t border-white/10">
                      <td className="py-2 pr-2 font-medium text-text-primary">{r.name}</td>
                      <td className="py-2 pr-2 text-text-muted">{r.date}</td>
                      <td className="py-2 pr-2 text-text-muted">{r.size}</td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-2">
                          <button aria-label={`Share ${r.name}`} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-text-muted hover:bg-white/5"><Share2 className="h-3 w-3" /></button>
                          <button aria-label={`Download ${r.name}`} className="flex items-center gap-1 rounded bg-accent/20 px-2 py-1 text-text-primary hover:bg-accent/30"><Download className="h-3 w-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Preview" />
            <p className="text-sm leading-relaxed text-text-muted">{previews[tab]}</p>
          </Card>
          <Card>
            <CardHeader title="Conservation Progress" icon={<Leaf className="h-4 w-4" />} />
            <ConservationMeter />
          </Card>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Generate Report">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted" htmlFor="report-type">Report Type</label>
            <select id="report-type" defaultValue={tab} className="mt-1 w-full rounded-control border border-white/10 bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
              {tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted" htmlFor="report-range">Date Range</label>
            <select id="report-range" defaultValue="Last 30 days" className="mt-1 w-full rounded-control border border-white/10 bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>Year to date</option>
            </select>
          </div>
          <Button className="w-full" loading={generating} onClick={generate}>
            {!generating && <><Plus className="h-4 w-4" /> Generate &amp; Export</>}
          </Button>
        </div>
      </Modal>
    </DashboardShell>
  );
}

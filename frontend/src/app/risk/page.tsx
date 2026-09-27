"use client";

import dynamic from "next/dynamic";
import { Brain, Clock } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { TimeMachine } from "@/components/innovation/TimeMachine";
import { RadialScore } from "@/components/visuals/Gauge";
import { LoadingState } from "@/components/ui/States";
import { riskPredictions, oceanHealth } from "@/data";
import { useAppStore } from "@/store/useAppStore";
import { useSimulatedLoad } from "@/hooks/useSimulatedLoad";
import type { TimeHorizon } from "@/types";

const RiskChart = dynamic(() => import("./RiskChart").then((m) => m.RiskChart), { ssr: false });

const categoryLabels: Record<string, string> = {
  coral_bleaching: "Coral Bleaching",
  biodiversity_loss: "Biodiversity Loss",
  pollution_expansion: "Pollution Expansion",
  illegal_fishing: "Illegal Fishing",
};

const narratives: Record<TimeHorizon, string> = {
  today: "Current readings show stable baseline conditions across monitored zones. Immediate intervention is not required, but three critical pollution sites remain active.",
  "1m": "Within one month, thermal stress accumulates in the Caribbean and Mediterranean. Coral bleaching onset and illegal discharge expansion become the dominant risks. Rapid response units should be pre-positioned.",
  "6m": "Over six months, plastic gyres expand with seasonal currents while reef resilience in the Coral Triangle buffers moderate bleaching. Sustained patrols reduce illegal fishing probability.",
  "1y": "At the one-year horizon, the Vaquita approaches a non-recoverable threshold without conservation action. Long-term pollution accumulation degrades water quality in two monitored basins.",
  "5y": "With active conservation interventions, ocean health recovers 13 points over five years. Protected corridors and reduced discharge reverse biodiversity decline in 4 of 6 regions.",
};

export default function RiskPage() {
  const horizon = useAppStore((s) => s.timeHorizon);
  const { status } = useSimulatedLoad();

  const trend = Array.from({ length: 12 }, (_, i) => {
    const base = 60 + i * (horizon === "5y" ? -1.5 : 1.2);
    const noise = Math.sin(i + horizon.length) * 4;
    const upper = Math.min(100, Math.round(base + noise + 10));
    const lower = Math.max(0, Math.round(base + noise - 10));
    return { month: `M${i + 1}`, upper, lower, mid: Math.round((upper + lower) / 2) };
  });

  const mapPoints = riskPredictions.map((r) => {
    const coords = {
      coral_bleaching: { lat: 18, lng: -77 },
      biodiversity_loss: { lat: 31, lng: -114 },
      pollution_expansion: { lat: 38, lng: 15 },
      illegal_fishing: { lat: -0.5, lng: -91 },
    }[r.category];
    const color = r.score >= 75 ? "#fb7185" : r.score >= 60 ? "#fb923c" : "#fbbf24";
    return {
      id: `${r.category}-${r.region}`,
      coordinates: coords,
      color,
      radius: 9,
      label: `${categoryLabels[r.category]} (${r.region})`,
      popup: (
        <div>
          <p className="font-semibold">{categoryLabels[r.category]}</p>
          <p className="text-xs">{r.region} · risk {r.score}</p>
        </div>
      ),
    };
  });

  return (
    <DashboardShell title="AI Risk Prediction Engine" subtitle="Forecast future environmental risks">
      {status === "loading" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex items-center justify-center lg:col-span-2" style={{ minHeight: 380 }}>
            <LoadingState label="Loading risk models…" />
          </Card>
          <Card className="flex items-center justify-center" style={{ minHeight: 380 }}>
            <LoadingState label="Loading risk models…" />
          </Card>
        </div>
      ) : (
      <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Time Machine Predictor" subtitle="Adjust horizon to update map & charts" icon={<Clock className="h-4 w-4" />} />
          <TimeMachine />
          <div className="mt-4">
            <OceanMap points={mapPoints} height="300px" />
          </div>
        </Card>
        <Card className="flex flex-col overflow-hidden !p-7">
          <CardHeader title="Risk Overview" subtitle="Score 0–100 (higher = greater risk)" icon={<Brain className="h-4 w-4" />} />
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <RadialScore size={140} value={oceanHealth.coralHealth} label="Coral Risk" subScores={oceanHealth} className="group" />
            <RadialScore size={160} value={oceanHealth.biodiversity} label="Biodiversity Risk" subScores={oceanHealth} className="group" />
            <RadialScore size={180} value={oceanHealth.pollution} label="Pollution Risk" subScores={oceanHealth} className="group" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Predictive Trend" subtitle="Shaded uncertainty band" />
          <RiskChart data={trend} />
        </Card>
        <Card>
          <CardHeader title="AI Risk Narrative" subtitle={`Horizon: ${horizon}`} icon={<Brain className="h-4 w-4" />} />
          <p className="text-sm leading-relaxed text-ocean-200/75">{narratives[horizon]}</p>
        </Card>
      </div>
      </>
      )}
    </DashboardShell>
  );
}

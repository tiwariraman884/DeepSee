"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Globe2, Brain, ShieldAlert, Waves, Leaf, BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingState, Skeleton } from "@/components/ui/States";
const DigitalTwin = dynamic(() => import("@/components/innovation/DigitalTwin").then((m) => m.DigitalTwin), { ssr: false, loading: () => <Skeleton className="h-[400px] w-full rounded-xl" /> });
const EmergencyCenter = dynamic(() => import("@/components/innovation/EmergencyCenter").then((m) => m.EmergencyCenter), { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-xl" /> });
const AIInsightsPanel = dynamic(() => import("@/components/innovation/AIInsightsPanel").then((m) => m.AIInsightsPanel), { ssr: false, loading: () => <Skeleton className="h-[200px] w-full rounded-xl" /> });
const RecommendationsPanel = dynamic(() => import("@/components/innovation/RecommendationsPanel").then((m) => m.RecommendationsPanel), { ssr: false, loading: () => <Skeleton className="h-[200px] w-full rounded-xl" /> });
import { TimeMachine } from "@/components/innovation/TimeMachine";
import { OceanHealth } from "@/components/visuals/OceanHealth";
import { useSimulatedLoad } from "@/hooks/useSimulatedLoad";

const PredictionCharts = dynamic(
  () => import("@/components/innovation/PredictionCharts").then((m) => m.PredictionCharts),
  {
    ssr: false,
    loading: () => (
      <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
        ))}
      </div>
    ),
  }
);

function InsightSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-secondary/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-secondary/60" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-secondary/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary/60" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InnovationPage() {
  const { status } = useSimulatedLoad();

  if (status === "loading") {
    return (
      <DashboardShell title="Innovation Lab" subtitle="Next-generation ocean intelligence">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader title="Digital Twin Ocean" icon={<Globe2 className="h-4 w-4" />} />
            <Skeleton className="h-80 w-full" />
          </Card>
          <Card className="lg:col-span-7">
            <CardHeader title="Time Machine Prediction" icon={<BarChart3 className="h-4 w-4" />} />
            <Skeleton className="h-80 w-full" />
          </Card>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="lg:col-span-3">
              <CardHeader title="Module" />
              <Skeleton className="h-40 w-full" />
            </Card>
          ))}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Innovation Lab" subtitle="Next-generation ocean intelligence">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Digital Twin */}
        <Card className="lg:col-span-5">
          <CardHeader
            title="Digital Twin Ocean"
            subtitle="Real-time ocean intelligence layer"
            icon={<Globe2 className="h-4 w-4" />}
          />
          <DigitalTwin />
        </Card>

        {/* Time Machine */}
        <Card className="lg:col-span-7">
          <CardHeader
            title="Time Machine Prediction"
            subtitle="Trend extrapolation with confidence intervals"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <TimeMachine />
        </Card>

        {/* Ocean Health */}
        <Card className="lg:col-span-4">
          <CardHeader
            title="Ocean Health Index"
            subtitle="Unified ecosystem score"
            icon={<Waves className="h-4 w-4" />}
          />
          <OceanHealth />
        </Card>

        {/* AI Insights */}
        <Card className="lg:col-span-4">
          <CardHeader
            title="AI Insights"
            subtitle="Model-generated observations"
            icon={<Brain className="h-4 w-4" />}
          />
          <AIInsightsPanel />
        </Card>

        {/* Emergency Alerts */}
        <Card className="lg:col-span-4">
          <CardHeader
            title="Emergency Response"
            subtitle="Active incidents requiring action"
            icon={<ShieldAlert className="h-4 w-4" />}
            action={
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                3 active
              </span>
            }
          />
          <EmergencyCenter />
        </Card>

        {/* Prediction Charts */}
        <Card className="col-span-full">
          <CardHeader
            title="Prediction Analytics"
            subtitle="Multi-metric forecast across horizons"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <PredictionCharts />
        </Card>

        {/* Recommendations */}
        <Card className="col-span-full">
          <CardHeader
            title="AI Recommendations"
            subtitle="Prioritized actions based on current conditions"
            icon={<Leaf className="h-4 w-4" />}
          />
          <RecommendationsPanel />
        </Card>
      </div>
    </DashboardShell>
  );
}

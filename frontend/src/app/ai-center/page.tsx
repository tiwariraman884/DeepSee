"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { LivePipelineStatus } from "@/components/pipeline/LivePipelineStatus";
import { AnomalyDetector } from "@/components/ai/AnomalyDetector";
import { PollutionForecast } from "@/components/ai/PollutionForecast";

export default function AICenterPage() {
  return (
    <DashboardShell
      title="AI Center"
      subtitle="Dedicated view for Live Pipeline, Anomaly Detection & Pollution Forecasts"
    >
      <div className="flex flex-col gap-6">
        <LivePipelineStatus />

        <div className="flex flex-col gap-6">
          <div className="w-full">
            <AnomalyDetector />
          </div>
          <div className="w-full">
            <PollutionForecast />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

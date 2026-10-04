"use client";

import { Download } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { LivePipelineStatus } from "@/components/pipeline/LivePipelineStatus";
import { AnomalyDetector } from "@/components/ai/AnomalyDetector";
import { PollutionForecast } from "@/components/ai/PollutionForecast";
import { EmergencyScenario } from "@/components/domain/EmergencyScenario";

export default function AICenterPage() {
  const downloadReport = () => {
    window.open("/api/reports/download", "_blank");
  };

  return (
    <DashboardShell
      title="AI Center"
      subtitle="Dedicated view for Live Pipeline, Anomaly Detection & Pollution Forecasts"
    >
      <div className="flex flex-col gap-6">
        
        <div className="flex justify-end">
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Download className="w-4 h-4" />
            Generate PDF Report
          </button>
        </div>

        <LivePipelineStatus />

        <EmergencyScenario />

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

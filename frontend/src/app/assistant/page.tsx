"use client";

import { Bot } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { AssistantChat } from "@/features/ai-assistant/AssistantChat";

export default function AssistantPage() {
  return (
    <DashboardShell title="AI Assistant" subtitle="Ask natural-language questions about the ocean">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="DeepSea Guardian Assistant"
            subtitle="Powered by ocean intelligence"
            icon={<Bot className="h-4 w-4" />}
          />
          <AssistantChat />
        </Card>
        <Card>
          <CardHeader title="Capabilities" />
          <ul className="space-y-3 text-sm text-ocean-200/70">
            <li>• Explain high-risk areas and drivers</li>
            <li>• Summarize pollution trends</li>
            <li>• List endangered species</li>
            <li>• Report active alerts & emergencies</li>
            <li>• Drone fleet status & battery</li>
            <li>• Coral bleaching risk forecasts</li>
            <li>• Ocean Health Index breakdown</li>
          </ul>
          <div className="mt-4 rounded-lg bg-ocean-500/10 p-3 text-xs text-ocean-200/70">
            Try: <span className="text-ocean-100">&quot;Why is this area high risk?&quot;</span>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

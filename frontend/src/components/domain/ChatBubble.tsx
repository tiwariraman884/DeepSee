"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/shared/ChartCard";
import { Sparkline } from "@/components/visuals/Sparkline";

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("### ")) {
      return (
        <h4 key={i} className="mt-2 font-semibold text-text-primary">
          {inline(line.slice(4))}
        </h4>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h3 key={i} className="mt-2 font-bold text-text-primary">
          {inline(line.slice(3))}
        </h3>
      );
    }
    if (/^[-*] /.test(line)) {
      return (
        <li key={i} className="ml-4 list-disc">
          {inline(line.slice(2))}
        </li>
      );
    }
    if (line.trim() === "") return <br key={i} />;
    return (
      <p key={i} className="leading-relaxed">
        {inline(line)}
      </p>
    );
  });
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={i} className="rounded bg-white/10 px-1 text-[0.85em] text-accent">
          {p.slice(1, -1)}
        </code>
      );
    return <span key={i}>{p}</span>;
  });
}

import type { AssistantChartData } from "@/features/ai-assistant/assistant";

export function ChatBubble({
  role,
  content,
  chartData,
  typing = false,
}: {
  role: "user" | "assistant";
  content: string;
  chartData?: AssistantChartData;
  typing?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", role === "user" && "justify-end")}>
      {role === "assistant" && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div className={cn("max-w-[85%]", role === "user" ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-card px-3 py-2 text-sm",
            role === "user" ? "bg-accent/20 text-text-primary" : "bg-secondary text-text-primary"
          )}
        >
          {typing ? (
            <span className="flex gap-1 py-1" aria-label="typing">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
            </span>
          ) : role === "assistant" ? (
            <div className="space-y-1">{renderMarkdown(content)}</div>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          )}
        </div>
        {chartData && !typing && (
          <div className="mt-2 w-64">
            <ChartCard title={chartData.title} chartType={chartData.chartType ?? "line"} height={120}>
              <Sparkline data={chartData.series} width={230} height={110} color="#0EA5E9" />
            </ChartCard>
          </div>
        )}
      </div>
      {role === "user" && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

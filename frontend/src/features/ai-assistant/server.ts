import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { pollution } from "@/data/pollution.json";
import { species } from "@/data/species.json";
import { alerts } from "@/data/alerts.json";
import { riskPredictions } from "@/data/metrics";
import { localAssistant, type AssistantResult } from "./assistant";

function criticalPollution() {
  return pollution
    .filter((p) => p.severity >= 7)
    .sort((a, b) => b.concentration - a.concentration);
}

async function anthropicAssistant(
  query: string,
  context?: Record<string, unknown>
): Promise<AssistantResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system = `You are the DeepSea Guardian AI assistant for an ocean pollution and biodiversity monitoring platform.
Answer concisely using the provided context. If the user asks about trends or risk, include a short "chartData" summary as JSON with a "title" string, a "chartType" of "line"|"bar"|"area", and a "series" array of numeric values derived from the context.`;

  const contextBlock = JSON.stringify({
    pollutionSites: pollution.length,
    criticalPollution: criticalPollution().map((p) => ({
      name: p.name,
      severity: p.severity,
      concentration: p.concentration,
      trend: p.trend,
    })),
    speciesTracked: species.length,
    openAlerts: alerts.filter((a) => !a.resolved).length,
    riskPredictions: riskPredictions.map((r) => ({
      category: r.category,
      region: r.region,
      riskScore: r.score,
      horizon: r.horizon,
    })),
    context,
  });

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system,
    messages: [
      {
        role: "user",
        content: `Context:\n${contextBlock}\n\nUser question: ${query}\n\nRespond with a JSON object: { "answer": string, "chartData"?: { "title": string, "chartType": "line"|"bar"|"area", "series": number[] } }`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = JSON.parse(text);
    const raw = parsed.chartData;
    const chartData = raw
      ? {
          title: raw.title ?? "Trend",
          chartType: (raw.chartType ?? raw.type ?? "line") as "line" | "bar" | "area",
          series: Array.isArray(raw.series)
            ? raw.series.map((d: { value?: number } | number) =>
                typeof d === "number" ? d : d.value
              )
            : [],
        }
      : undefined;
    return {
      answer: parsed.answer ?? text,
      chartData,
    };
  } catch {
    return { answer: text };
  }
}

export async function askAssistant(
  query: string,
  context?: Record<string, unknown>
): Promise<AssistantResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await anthropicAssistant(query, context);
    } catch {
      return localAssistant(query);
    }
  }
  return localAssistant(query);
}

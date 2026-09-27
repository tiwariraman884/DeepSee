import { pollution } from "@/data/pollution.json";
import { species } from "@/data/species.json";
import { alerts } from "@/data/alerts.json";
import { drones } from "@/data/drones.json";
import { oceanHealth, riskPredictions, timeSeries } from "@/data/metrics";
import { pollutionLabels } from "@/lib/constants";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  chartData?: AssistantChartData;
}

export interface AssistantChartData {
  title: string;
  chartType?: "line" | "bar" | "area";
  series: number[];
}

export interface AssistantResult {
  answer: string;
  chartData?: AssistantChartData;
}

function criticalPollution() {
  return pollution
    .filter((p) => p.severity >= 7)
    .sort((a, b) => b.concentration - a.concentration);
}

function endangered() {
  return species.filter(
    (s) => s.status === "endangered" || s.status === "critically_endangered"
  );
}

function pollutionSeries(title = "Pollution concentration over time"): AssistantChartData {
  return {
    title,
    chartType: "line",
    series: timeSeries.map((t) => t.pollution),
  };
}

export function localAssistant(question: string): AssistantResult {
  const q = question.toLowerCase();

  if (q.includes("high risk") || q.includes("why") || q.includes("risk")) {
    const top = criticalPollution()[0];
    return {
      answer: `The highest-risk area is "${top.name}" (${pollutionLabels[top.type]}). It has a severity of ${top.severity}/10 with a concentration index of ${top.concentration} across ${top.affectedArea.toLocaleString()} km². Primary driver: ${top.trend} accumulation trend. Recommend prioritizing drone patrol and containment.`,
      chartData: pollutionSeries("Pollution hotspots by concentration"),
    };
  }

  if (q.includes("pollution trend") || q.includes("trend")) {
    const inc = pollution.filter((p) => p.trend === "increasing").length;
    const dec = pollution.filter((p) => p.trend === "decreasing").length;
    return {
      answer: `Across ${pollution.length} monitored sites: ${inc} are increasing, ${dec} are decreasing. Hotspots: ${criticalPollution()
        .slice(0, 2)
        .map((p) => p.name)
        .join(", ")}.`,
      chartData: pollutionSeries("Pollution trend across monitored sites"),
    };
  }

  if (q.includes("endangered") || q.includes("species")) {
    const list = endangered();
    return {
      answer: `There are ${list.length} endangered or critically endangered species tracked, including ${list
        .slice(0, 3)
        .map((s) => s.name)
        .join(", ")}. The most urgent is the Vaquita (population ~10).`,
    };
  }

  if (q.includes("alert") || q.includes("emergency")) {
    const open = alerts.filter((a) => !a.resolved);
    return {
      answer: `There are ${open.length} open alerts. Latest: "${open[0]?.message.split(" — ")[0]}" in ${open[0]?.location}. Critical ones require immediate response.`,
    };
  }

  if (q.includes("drone") || q.includes("fleet")) {
    const active = drones.filter((d) => d.status === "active").length;
    return {
      answer: `${active} drones are currently active out of ${drones.length} in the fleet. Lowest battery: ${drones
        .filter((d) => d.battery < 40)
        .map((d) => `${d.name} (${d.battery}%)`)
        .join(", ")}.`,
    };
  }

  if (q.includes("coral")) {
    const coral = riskPredictions.find((r) => r.category === "coral_bleaching");
    return {
      answer: `Coral bleaching risk is ${coral?.score}/100 (confidence ${coral?.confidence}%) for ${coral?.region} within ${coral?.horizon}. ${coral?.narrative}`,
    };
  }

  if (q.includes("health") || q.includes("index")) {
    return {
      answer: `Ocean Health Index is ${oceanHealth.overall}/100 — Pollution ${oceanHealth.pollution}, Biodiversity ${oceanHealth.biodiversity}, Water Quality ${oceanHealth.waterQuality}, Coral Health ${oceanHealth.coralHealth}. Coral health is the weakest pillar and needs attention.`,
    };
  }

  if (q.includes("hello") || q.includes("hi ") || q.includes("help")) {
    return {
      answer: `Hello, I'm the DeepSea Guardian AI assistant. Ask me about pollution trends, endangered species, active alerts, drone fleet status, coral bleaching risk, or the ocean health index.`,
    };
  }

  return {
    answer: `I analyzed our live ocean intelligence. Based on current data: ${pollution.length} pollution sites, ${species.length} species tracked, ${alerts.filter((a) => !a.resolved).length} open alerts. Try asking "Why is this area high risk?", "Show pollution trends", or "Which species are endangered?"`,
  };
}

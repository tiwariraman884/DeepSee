/**
 * Incident Report PDF rendering (Step 4) — PDFKit, same dependency as the
 * existing generic reports. Professional operations document, light print
 * background with severity color-coding. Evidence is rendered as cards/tables
 * (no image placeholders — no photographic evidence is persisted).
 */
import PDFDocument from "pdfkit";
import type { IncidentReport } from "./incidentReport";

const INK = "#0F172A";
const MUTED = "#64748B";
const ACCENT = "#0E7490";
const RULE = "#E2E8F0";

function severityColor(severity: string | null): string {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return "#DC2626";
    case "high": return "#EA580C";
    case "medium": return "#CA8A04";
    case "low": return "#16A34A";
    default: return MUTED;
  }
}

function section(doc: typeof PDFDocument.prototype, title: string): void {
  doc.moveDown(1);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(INK).text(title);
  doc.moveDown(0.3);
  doc.strokeColor(RULE).lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function kv(doc: typeof PDFDocument.prototype, label: string, value: string): void {
  doc.fontSize(10).font("Helvetica-Bold").fillColor(MUTED).text(label + "  ", { continued: true });
  doc.font("Helvetica").fillColor(INK).text(value);
}

function cell(doc: typeof PDFDocument.prototype, text: string, opts: { bold?: boolean; color?: string; continued?: boolean; width?: number } = {}): void {
  doc.fontSize(9)
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fillColor(opts.color ?? INK)
    .text(text, { continued: opts.continued, width: opts.width });
}

export function buildIncidentReportPdf(report: IncidentReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const sevColor = severityColor(report.incident.severity);

      // ── Header ──────────────────────────────────────────────────────────────
      doc.fontSize(20).font("Helvetica-Bold").fillColor(INK).text("DEEPSEA GUARDIAN", { align: "center" });
      doc.fontSize(12).font("Helvetica").fillColor(ACCENT).text("AUTONOMOUS OCEAN INCIDENT REPORT", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(sevColor)
        .text(`SEVERITY: ${(report.incident.severity ?? "UNKNOWN").toUpperCase()}`, { align: "center" });
      doc.moveDown(0.5);
      kv(doc, "Incident ID:", report.reportId);
      kv(doc, "Inspection ID:", report.inspectionId);
      kv(doc, "Generated:", report.generatedAt);
      kv(doc, "Status:", report.incident.status);

      // ── 1. Incident Summary ─────────────────────────────────────────────────
      section(doc, "1 — Incident Summary");
      kv(doc, "Title:", report.incident.title);
      kv(doc, "Location:", report.incident.location ?? "unavailable");
      const lat = report.incident.latitude, lng = report.incident.longitude;
      kv(doc, "Coordinates:", lat !== null && lng !== null ? `${lat}, ${lng}` : "unavailable");
      kv(doc, "Sensor:", `${report.incident.sensorName ?? "?"} (${report.incident.sensorId ?? "?"})`);
      kv(doc, "Alert:", report.incident.alertId ?? "unavailable");
      kv(doc, "Detected:", report.incident.detectedAt ?? "unavailable");
      kv(doc, "Severity:", report.incident.severity ?? "unavailable");
      kv(doc, "Data source:", report.incident.dataSource
        ? `${report.incident.dataSource}${report.incident.deviceId ? ` (${report.incident.deviceId})` : ""}`
        : "unavailable");

      // ── 2. Detection ────────────────────────────────────────────────────────
      section(doc, "2 — Detection (trigger sensor reading)");
      const r = report.sensorReadings;
      const rows: [string, string][] = [
        ["Temperature", r?.temperature !== null && r?.temperature !== undefined ? `${r.temperature} °C` : "unavailable"],
        ["pH", r?.ph !== null && r?.ph !== undefined ? String(r.ph) : "unavailable"],
        ["Salinity", r?.salinity !== null && r?.salinity !== undefined ? `${r.salinity} PSU` : "unavailable"],
        ["Oxygen", r?.oxygen !== null && r?.oxygen !== undefined ? `${r.oxygen} mg/L` : "unavailable"],
        ["Turbidity", r?.turbidity !== null && r?.turbidity !== undefined ? `${r.turbidity} NTU` : "unavailable"],
      ];
      rows.forEach(([k, v]) => kv(doc, k + ":", String(v)));
      kv(doc, "Recorded at:", r?.recordedAt ?? "unavailable");
      kv(doc, "Alert message:", report.detection.message ?? "unavailable");
      kv(doc, "Anomaly score:", report.detection.anomalyScore !== null ? String(report.detection.anomalyScore) : "unavailable (not persisted)");

      // ── 3. Autonomous Response ──────────────────────────────────────────────
      section(doc, "3 — Autonomous Response");
      kv(doc, "Drone:", `${report.response.droneName ?? "?"} (${report.response.droneId ?? "?"})`);
      kv(doc, "Selection:", report.response.selectionReason ?? "unavailable");
      kv(doc, "Distance:", report.response.distanceKm !== null ? `${report.response.distanceKm} km` : "unavailable");
      kv(doc, "ETA:", report.response.etaSeconds !== null ? `${report.response.etaSeconds}s` : "unavailable");
      kv(doc, "Origin:", `${report.response.origin.lat ?? "?"}, ${report.response.origin.lng ?? "?"}`);
      kv(doc, "Target:", `${report.response.target.lat ?? "?"}, ${report.response.target.lng ?? "?"}`);
      kv(doc, "Dispatched:", report.response.dispatchedAt ?? "unavailable");
      kv(doc, "Arrival:", "Recorded in live mission timeline");
      kv(doc, "Completed:", report.response.completedAt ?? "unavailable");

      // ── 4. AI Inspection ────────────────────────────────────────────────────
      section(doc, "4 — AI Inspection");
      kv(doc, "Duration:", report.inspection.durationSeconds !== null ? `${report.inspection.durationSeconds}s` : "unavailable");
      kv(doc, "Findings:", `${report.inspection.findings.length} threat(s)`);
      kv(doc, "Vision source:", report.vision.sourceType ?? "not recorded");
      kv(doc, "Frames:", `${report.vision.framesCaptured} captured / ${report.vision.framesProcessed} processed / ${report.vision.framesDropped} dropped`);
      report.inspection.findings.forEach((f, i) => {
        cell(doc, `  ${i + 1}. ${f.label} — ${f.confidence !== null ? `${Math.round(f.confidence > 1 ? f.confidence : f.confidence * 100)}%` : "n/a"}`);
      });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").fillColor(INK).text(report.inspection.summary ?? "No summary recorded.", { width: 500 });

      // ── 5. Evidence ─────────────────────────────────────────────────────────
      section(doc, "5 — Evidence");
      if (report.evidence.length === 0) {
        cell(doc, "No evidence items persisted for this inspection.");
      } else {
        report.evidence.forEach((e, i) => {
          cell(doc, `Evidence #${String(i + 1).padStart(2, "0")} — ${e.label}`, { bold: true });
          cell(doc, `  Type: ${e.kind}  ·  Confidence: ${e.confidenceDisplay}  ·  Captured: ${e.capturedAt}`);
          if (e.detail) {
            doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(`  ${e.detail}`, { width: 500 });
          }
          doc.moveDown(0.3);
        });
      }

      // ── 6. Timeline ─────────────────────────────────────────────────────────
      section(doc, "6 — Incident Timeline");
      report.timeline.forEach((t) => {
        cell(doc, `${t.timestamp} — ${t.event}`, { bold: true });
        doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(`  ${t.description}`, { width: 500 });
        doc.moveDown(0.2);
      });

      // ── 7. Final Assessment ─────────────────────────────────────────────────
      section(doc, "7 — Final Assessment");
      kv(doc, "Severity:", report.finalAssessment.severity ?? "unavailable");
      kv(doc, "Threat count:", String(report.finalAssessment.threatCount));
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").fillColor(INK).text(report.finalAssessment.assessment, { width: 500 });

      // ── 8. Demo Disclosure ──────────────────────────────────────────────────
      section(doc, "8 — Demo / Simulation Disclosure");
      doc.fontSize(9).font("Helvetica-Oblique").fillColor(MUTED).text(report.disclosure, { width: 500 });

      doc.moveDown(2);
      doc.fontSize(8).fillColor("#94A3B8").text("Generated automatically by DeepSea Guardian incident pipeline", { align: "center" });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

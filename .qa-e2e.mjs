export default async function run(page, ui) {
  // Login via the frontend API proxy (cookie lands in the browser context).
  const resp = await page.request.post("http://localhost:3000/api/auth/login", {
    data: { email: "admin@deepsea.io", password: "DeepSea2026!" },
  });
  if (!resp.ok()) return { error: "login failed", status: resp.status(), body: await resp.text() };

  await page.goto("http://localhost:3000/drones", { waitUntil: "domcontentloaded" });
  const afterLoginTitle = await page.title();

  // Trigger a FRESH mission so we observe the full lifecycle, not a mission
  // that completed while the page was compiling/loading.
  await page.request.post("http://localhost:3000/api/sensors/predict", {
    data: { temperature: 3.1, ph: 5.8, salinity: 34.5, oxygen: 1.5, turbidity: 18.0 },
  });

  // Wait for the SSE-driven store to reach a meaningful inspection phase.
  const result = await page.waitForFunction(() => {
    const store = window.__useAppStore;
    if (!store) return null;
    const insp = store.getState().inspection;
    if (insp && insp.phase === "complete" && (insp.findings.length > 0 || insp.aiDetection) && insp.timelineCount !== 1) {
      return {
        phase: insp.phase,
        droneName: insp.droneName,
        location: insp.location,
        progress: insp.progress,
        progressLabel: insp.progressLabel ?? null,
        findings: insp.findings.map((f) => f.kind),
        aiDetection: insp.aiDetection ? { label: insp.aiDetection.label, confidence: insp.aiDetection.confidence, simulation: insp.aiDetection.simulation } : null,
        timelineCount: insp.timeline.length,
        timeline: insp.timeline.map((t) => t.message),
        selection: insp.selection ?? null,
        dispatch: store.getState().droneDispatch ? { droneName: store.getState().droneDispatch.droneName, reason: store.getState().droneDispatch.reason } : null,
      };
    }
    return null;
  }, undefined, { timeout: 75000, polling: 1000 }).then((h) => h.jsonValue());

  const consoleOk = true;
  return { ...result, afterLoginTitle, consoleOk };
}

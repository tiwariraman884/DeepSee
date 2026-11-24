/**
 * Client for the Python ML service over HTTP.
 *
 * Why this exists: in production the backend and `ml/` are separate deployments
 * (Vercel services — see vercel.json), so the backend cannot spawn a Python child
 * process. Vercel injects the ML service's internal base URL into this service
 * through a binding; this module is the single place that reads it.
 *
 * Resolution order:
 *   1. ML_URL         — injected by the Vercel binding (do not set it yourself)
 *   2. ML_SERVICE_URL — optional override for running against the HTTP service
 *      locally (`python -m uvicorn main:app` in ml/, or a container)
 *   3. unset          — callers fall back to the local Python child-process
 *      transport (mlWorker / speciesWorker), which is how desktop and Docker
 *      deployments run without an HTTP service.
 *
 * Bindings resolve at runtime only — never during the frontend build or in
 * middleware — so this module is imported lazily by the backend, which is fine.
 */

/** Base URL of the ML service, or null when no HTTP service is configured. */
export function mlServiceUrl(): string | null {
  const configured = process.env.ML_URL?.trim() || process.env.ML_SERVICE_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : null;
}

export function mlServiceEnabled(): boolean {
  return mlServiceUrl() !== null;
}

/** POST JSON to the ML service and return the parsed response body. */
export async function mlServicePost<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const base = mlServiceUrl();
  if (!base) throw new Error("ML service URL is not configured (ML_URL / ML_SERVICE_URL)");

  const res = await fetch(new URL(path.replace(/^\/+/, ""), `${base}/`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const detail = parsed?.message || parsed?.detail || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(`ML service ${path} failed: ${detail}`);
  }
  return parsed as T;
}

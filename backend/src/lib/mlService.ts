/**
 * Client for the Python ML service over HTTP.
 *
 * Why this exists: in production the backend and `ml/` are separate deployments
 * (Vercel services — see vercel.json), so the backend cannot spawn a Python child
 * process. Vercel injects the ML service's internal base URL into this service as
 * `ML_SERVICE_URL` via a service binding, and this client posts to it.
 *
 * Resolution order:
 *   1. ML_SERVICE_URL — injected by the Vercel binding (do not set it yourself)
 *   2. ML_SERVICE_URL in .env for local runs, e.g. http://127.0.0.1:8000
 *      (`python ml/app.py` serves the same endpoints)
 *   3. unset — callers fall back to the local NDJSON child-process transport
 *      (mlWorker / speciesWorker), which is how desktop/Docker deployments run.
 *
 * Bindings resolve at runtime only — never during the Next.js build or in
 * middleware — so this module is imported lazily by the backend, which is fine.
 */

/** Base URL of the ML service, or null when no HTTP service is configured. */
export function mlServiceUrl(): string | null {
  const configured = process.env.ML_SERVICE_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : null;
}

export function mlServiceEnabled(): boolean {
  return mlServiceUrl() !== null;
}

/** POST JSON to the ML service and return the parsed response body. */
export async function mlServicePost<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const base = mlServiceUrl();
  if (!base) throw new Error("ML_SERVICE_URL is not configured");

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

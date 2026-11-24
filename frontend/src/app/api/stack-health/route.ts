/** Private backend binding verification, invoked from a Next.js server function. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return Response.json({ status: "unavailable", reason: "backend_binding_missing" },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(new URL("/api/health", backendUrl), {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return Response.json({
      status: response.ok ? "ok" : "unavailable",
      backend: data.status ?? "unknown",
      mlWorkerReady: Boolean(data.mlWorker?.ready),
    }, { status: response.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", reason: "backend_unreachable" },
      { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

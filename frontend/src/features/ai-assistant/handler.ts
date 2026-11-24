/**
 * POST /api/assistant — request pipeline, transport-agnostic.
 * ===========================================================
 * Kept separate from app/api/assistant/route.ts so the real handler (auth →
 * rate limit → validation → model call → error mapping) can be exercised by
 * tests without importing next/server. The route file is a one-line binding.
 *
 * Order of checks is deliberate:
 *   1. Method  — reject non-POST before any work.
 *   2. Auth    — authentication before rate limiting, so unauthenticated
 *                traffic cannot consume the per-user budget of a real user
 *                (and unauthenticated callers get no model access at all).
 *   3. Rate    — per authenticated user, not per IP: the assistant is an
 *                authenticated surface, and IP keying lets one shared NAT
 *                exhaust everyone's budget.
 *   4. Validate — Zod schema shared with the client.
 *   5. Answer  — askAssistant(), which owns the model/local fallback.
 *
 * Secrets stay server-side: ANTHROPIC_API_KEY is read only inside
 * features/ai-assistant/server.ts, which imports "server-only".
 */
import { askAssistant } from "@/features/ai-assistant/server";
import type { AssistantResult } from "@/features/ai-assistant/assistant";
import { assistantQuerySchema } from "@/features/ai-assistant/schema";
import { requireSession } from "@/lib/auth/require-session";

/** 20 questions per minute per authenticated user. */
export const ASSISTANT_RATE_LIMIT = { max: 20, windowMs: 60_000 } as const;

export interface RateLimiter {
  hit(key: string): boolean;
  retryAfter(key: string): number;
}

type Ask = (query: string) => Promise<AssistantResult>;

export interface HandlerDeps {
  limiter: RateLimiter;
  ask?: Ask;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Assistant answers are per-user and derived from live data.
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function createAssistantHandler(deps: HandlerDeps) {
  const ask: Ask = deps.ask ?? ((query) => askAssistant(query));

  return async function POST(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    }

    // ── 2. Authentication (fail closed) ──────────────────────────────────────
    const session = requireSession(request);
    if (!session.ok) {
      return json({ error: session.error }, session.status);
    }

    // ── 3. Rate limit per authenticated user ────────────────────────────────
    const bucket = `user:${session.user.id}`;
    if (!deps.limiter.hit(bucket)) {
      const retryAfter = deps.limiter.retryAfter(bucket);
      return json(
        { error: "Too many requests", retryAfter },
        429,
        { "Retry-After": String(retryAfter) }
      );
    }

    // ── 4. Validation ───────────────────────────────────────────────────────
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = assistantQuerySchema.safeParse(payload);
    if (!parsed.success) {
      return json(
        {
          error: "Validation failed",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }

    // ── 5. Answer (model call, with its own local fallback) ──────────────────
    try {
      const result = await ask(parsed.data.query);
      if (!result || typeof result.answer !== "string" || result.answer.length === 0) {
        // Never substitute generated text for a failure: surface it.
        return json({ error: "Assistant returned no answer" }, 502);
      }
      return json(result, 200);
    } catch (err) {
      // askAssistant already falls back to localAssistant on model failure, so
      // reaching here means the fallback itself failed. Log detail server-side,
      // return a generic message (no internal detail to the client).
      console.error("[assistant] handler failed:", err instanceof Error ? err.message : err);
      return json({ error: "Assistant temporarily unavailable" }, 503);
    }
  };
}
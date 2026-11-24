"use client";

import { assistantQuerySchema } from "@/features/ai-assistant/schema";
import type { AssistantResult } from "@/features/ai-assistant/assistant";

/**
 * Browser-side call to POST /api/assistant.
 *
 * Both chat components previously duplicated this fetch and threw a generic
 * Error on any non-2xx, so a 401 (session expired) and a 429 (rate limited)
 * looked identical to the user. This returns a discriminated result instead:
 * the caller decides what to render, and nothing is swallowed.
 */
export type AskOutcome =
  | { ok: true; result: AssistantResult }
  | { ok: false; status: number; message: string; retryAfter?: number };

export async function requestAssistant(query: string): Promise<AskOutcome> {
  // Mirror the server schema so obvious mistakes never leave the browser.
  const local = assistantQuerySchema.safeParse({ query });
  if (!local.success) {
    return {
      ok: false,
      status: 400,
      message: local.error.issues[0]?.message ?? "Invalid question",
    };
  }

  let res: Response;
  try {
    res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local.data),
      // Send the httpOnly session cookie explicitly; same-origin already does,
      // this keeps the requirement visible at the call site.
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, status: 0, message: "Network error — the assistant is unreachable." };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const body = (payload ?? {}) as Record<string, unknown>;

  if (!res.ok) {
    const message =
      res.status === 401
        ? "Your session expired. Please sign in again to use the assistant."
        : res.status === 429
          ? "You're asking quickly — please wait a moment and retry."
          : typeof body.error === "string"
            ? body.error
            : "The assistant is temporarily unavailable. Please try again.";
    return {
      ok: false,
      status: res.status,
      message,
      retryAfter: typeof body.retryAfter === "number" ? body.retryAfter : undefined,
    };
  }

  const answer = body.answer;
  if (typeof answer !== "string" || answer.length === 0) {
    return { ok: false, status: res.status, message: "The assistant returned no answer." };
  }

  return {
    ok: true,
    result: {
      answer,
      chartData: body.chartData as AssistantResult["chartData"],
    },
  };
}
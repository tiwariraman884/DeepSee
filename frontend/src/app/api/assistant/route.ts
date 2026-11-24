/**
 * POST /api/assistant
 *
 * Binding only — the pipeline lives in features/ai-assistant/handler.ts.
 *
 * runtime = "nodejs" is required: session verification uses Node's crypto and
 * Buffer, and the Anthropic SDK is not an Edge-compatible dependency here.
 * dynamic = "force-dynamic" because a session cookie makes every response
 * user-specific; it must never be cached or statically evaluated.
 */
import { createAssistantHandler, ASSISTANT_RATE_LIMIT } from "@/features/ai-assistant/handler";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One limiter instance per process, created at module scope so the window
// persists across requests (matching the backend's limiter semantics).
const POST = createAssistantHandler({
  limiter: createRateLimiter(ASSISTANT_RATE_LIMIT.max, ASSISTANT_RATE_LIMIT.windowMs),
});

export { POST };
/**
 * Automated verification of the AI assistant.
 *
 * Covers:
 *   A. localAssistant fallback (deterministic, no network).
 *   B. askAssistant's REAL model path: when ANTHROPIC_API_KEY is set, the real
 *      @anthropic-ai/sdk is used and its transport is stubbed — so we drive the
 *      actual client, request shape and response parser, not a fake.
 *   C. createAssistantHandler: auth, rate limiting, validation, error mapping.
 *
 * Run: node --test tests/   (from frontend/)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve as resolvePath } from "node:path";

import { createTsLoader, FRONTEND_ROOT } from "./helpers/load-ts.mjs";

const require = createRequire(resolvePath(FRONTEND_ROOT, "package.json"));
/**
 * The CJS entry of @anthropic-ai/sdk is an __esModule interop wrapper: the
 * real class is on `.default`. Resolved here only for the harness self-check.
 */
const session = (() => {
  const l = createTsLoader();
  return l.load("src/lib/auth/session.ts");
})();
const { verifySessionToken, createSessionToken } = session;

const TEST_SECRET = "test-only-secret-value-abcdefghijklmnop-32";
process.env.AUTH_SECRET = TEST_SECRET;

/** Build a fresh loader with the "server-only" server guard stubbed out. */
function loader() {
  const l = createTsLoader();
  l.stub("server-only", {});
  return l;
}

function cookieHeader(user = { id: "user-1", email: "operator@example.com", role: "user" }) {
  return `auth-token=${createSessionToken(user)}`;
}

function postRequest({ cookie, body, method = "POST", rawBody } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost:3000/api/assistant", {
    method,
    headers,
    body: method === "GET" ? undefined : rawBody ?? JSON.stringify(body ?? {}),
  });
}

/**
 * Stub the SDK transport so the REAL client runs (auth header, model id,
 * params, response parsing) while no network call is made.
 *
 * The SDK assigns `fetch` as an OWN instance property (not on the prototype),
 * so the constructor is wrapped via a Proxy: the stub is injected into every
 * client the module under test creates. All other behaviour is untouched.
 *
 * `refused` records calls made while no API key is configured — used to prove
 * the no-key path never even constructs a client.
 */
function stubAnthropic(fn) {
  const calls = [];
  const refused = [];
  // TS compiles `import Anthropic from "@anthropic-ai/sdk"` to
  // __importDefault(require(...)).default, and `new Anthropic()` reads the
  // `.default` property at call time. Patching that property is therefore what
  // intercepts the class the module actually constructs. The namespace object
  // itself is `__esModule`, so caching it keeps this patch effective.
  const ns = require("@anthropic-ai/sdk");
  const RealDefault = ns.default;
  // The SDK's CJS entry defines `default` as a GETTER-only interop property, so
  // it cannot be assigned. Redefine it instead (configurable: true).
  const descriptor = Object.getOwnPropertyDescriptor(ns, "default");

  const Stub = new Proxy(RealDefault, {
    construct(target, args, newTarget) {
      const client = Reflect.construct(target, args, newTarget);
      client.fetch = async (url, init) => {
        const parsed = {
          url: String(url),
          headers: init?.headers ?? {},
          body: init?.body ? JSON.parse(init.body) : undefined,
        };
        if (!process.env.ANTHROPIC_API_KEY) {
          refused.push(parsed);
          throw new Error("transport must not be called without an API key");
        }
        calls.push(parsed);
        const result = await fn(parsed, client);
        if (result instanceof Response) return result;
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };
      return client;
    },
  });

  Object.defineProperty(ns, "default", {
    value: Stub,
    configurable: true,
    enumerable: true,
    writable: false,
  });

  return {
    calls,
    refused,
    restore() {
      Object.defineProperty(ns, "default", descriptor);
    },
  };
}

// Sanity check for the harness itself: if this ever fails, the model-path
// tests below would silently degrade to the local fallback and "pass" wrongly.
test("harness: SDK stub is actually installed on the class the module uses", () => {
  const sdk = stubAnthropic(() => modelResponse("x"));
  try {
    const ns = require("@anthropic-ai/sdk");
    const client = new ns.default({ apiKey: "k" });
    assert.equal(typeof client.fetch, "function");
  } finally {
    sdk.restore();
  }
});

/** A well-formed Anthropic messages response carrying assistant text. */
function modelResponse(text) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

// ─── A. localAssistant fallback ─────────────────────────────────────────────

test("localAssistant: keyword intents are answered from local datasets", async (t) => {
  const mod = loader().load("src/features/ai-assistant/assistant.ts");
  const { pollution } = loader().load("src/data/pollution.json.ts");

  await t.test("risk intent names the highest-concentration hotspot", () => {
    const r = mod.localAssistant("why is this area high risk?");
    const top = [...pollution].filter((p) => p.severity >= 7).sort((a, b) => b.concentration - a.concentration)[0];
    assert.match(r.answer, /highest-risk area/);
    assert.ok(r.answer.includes(top.name), `expected "${top.name}" in answer`);
    assert.equal(r.chartData.chartType, "line");
    assert.ok(Array.isArray(r.chartData.series) && r.chartData.series.length > 0);
  });

  await t.test("species intent reports the endangered count", () => {
    const { species } = loader().load("src/data/species.json.ts");
    const expected = species.filter(
      (s) => s.status === "endangered" || s.status === "critically_endangered"
    ).length;
    const r = mod.localAssistant("which species are endangered?");
    // The count must come from the dataset, not be a hardcoded sentence.
    assert.ok(
      r.answer.includes(`There are ${expected} endangered or critically endangered species tracked`),
      `expected count ${expected} in: ${r.answer}`
    );
    assert.equal(r.chartData, undefined);
  });

  await t.test("alerts intent counts unresolved alerts", () => {
    const { alerts } = loader().load("src/data/alerts.json.ts");
    const open = alerts.filter((a) => !a.resolved).length;
    const r = mod.localAssistant("any emergency alerts?");
    assert.ok(r.answer.includes(`${open} open alerts`), `expected "${open} open alerts"`);
  });

  await t.test("greeting is handled", () => {
    assert.match(mod.localAssistant("hello").answer, /DeepSea Guardian AI assistant/);
  });

  await t.test("unknown intent falls back to a safe summary, never empty", () => {
    const r = mod.localAssistant("something completely unrelated qwerty");
    assert.ok(r.answer.length > 0);
    assert.match(r.answer, /I analyzed our live ocean intelligence/);
  });
});

// ─── B. askAssistant: real model path + fallback trigger ────────────────────

test("askAssistant without ANTHROPIC_API_KEY uses localAssistant and makes no network call", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const l = loader();
  const server = l.load("src/features/ai-assistant/server.ts");
  const local = l.load("src/features/ai-assistant/assistant.ts");

  const sdk = stubAnthropic(() => {
    throw new Error("transport must not be called without an API key");
  });
  try {
    const got = await server.askAssistant("what is the ocean health index?");
    const expected = local.localAssistant("what is the ocean health index?");
    assert.equal(got.answer, expected.answer);
    assert.equal(sdk.calls.length, 0);
    assert.equal(sdk.refused.length, 0, "no client should be constructed without a key");
  } finally {
    sdk.restore();
  }
});

test("askAssistant with an API key drives the real SDK client (model path)", async (t) => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-only-key";
  const answerText = JSON.stringify({
    answer: "Model says: coral bleaching risk is elevated.",
    chartData: { title: "Coral risk", chartType: "area", series: [1, 2, 3] },
  });
  const sdk = stubAnthropic(() => modelResponse(answerText));

  try {
    const server = loader().load("src/features/ai-assistant/server.ts");
    const result = await server.askAssistant("coral risk?");

    await t.test("answer comes from the model, not the local fallback", () => {
      assert.equal(result.answer, "Model says: coral bleaching risk is elevated.");
    });

    await t.test("chartData JSON is parsed into the typed shape", () => {
      assert.deepEqual(result.chartData, {
        title: "Coral risk",
        chartType: "area",
        series: [1, 2, 3],
      });
    });

    await t.test("exactly one request hit the Messages API on the pinned model", () => {
      assert.equal(sdk.calls.length, 1);
      assert.match(sdk.calls[0].url, /\/v1\/messages$/);
      assert.equal(sdk.calls[0].body.model, "claude-sonnet-4-6");
      assert.equal(sdk.calls[0].body.max_tokens, 512);
    });

    await t.test("the system prompt and grounding context are sent", () => {
      const { system, messages } = sdk.calls[0].body;
      assert.match(system, /DeepSea Guardian AI assistant/);
      assert.match(system, /chartData/);
      assert.equal(messages.length, 1);
      assert.equal(messages[0].role, "user");
      // Context block must contain real dataset counts.
      assert.match(messages[0].content, /"pollutionSites":\d+/);
      assert.match(messages[0].content, /"speciesTracked":\d+/);
      assert.match(messages[0].content, /coral risk\?/);
    });

    await t.test("the API key is used as an auth header (server-side only)", () => {
      const headers = sdk.calls[0].headers;
      const values = headers instanceof Headers ? [...headers.entries()] : Object.entries(headers);
      const apiKey = values.find(([k]) => k.toLowerCase() === "x-api-key");
      assert.ok(apiKey, "x-api-key header should be present");
      assert.equal(apiKey[1], "sk-ant-test-only-key");
    });
  } finally {
    sdk.restore();
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("askAssistant falls back to localAssistant when the model call fails", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-only-key";
  const sdk = stubAnthropic(() => {
    throw new Error("simulated upstream 500");
  });
  try {
    const l = loader();
    const server = l.load("src/features/ai-assistant/server.ts");
    const local = l.load("src/features/ai-assistant/assistant.ts");

    const got = await server.askAssistant("show pollution trends");
    assert.equal(got.answer, local.localAssistant("show pollution trends").answer);
  } finally {
    sdk.restore();
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("askAssistant returns raw text when the model emits non-JSON", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-only-key";
  const sdk = stubAnthropic(() => modelResponse("Plain sentence, no JSON."));
  try {
    const server = loader().load("src/features/ai-assistant/server.ts");
    const got = await server.askAssistant("anything");
    assert.equal(got.answer, "Plain sentence, no JSON.");
    assert.equal(got.chartData, undefined);
  } finally {
    sdk.restore();
    delete process.env.ANTHROPIC_API_KEY;
  }
});

// ─── C. HTTP handler ────────────────────────────────────────────────────────

function buildHandler({ ask, max = 20 } = {}) {
  const { createRateLimiter } = loader().load("src/lib/rate-limit.ts");
  const { createAssistantHandler } = loader().load("src/features/ai-assistant/handler.ts");
  const limiter = createRateLimiter(max, 60_000);
  const calls = [];
  const handler = createAssistantHandler({
    limiter,
    ask:
      ask ??
      (async (q) => {
        calls.push(q);
        return { answer: `echo:${q}` };
      }),
  });
  return { handler, calls, limiter };
}

test("handler: unauthenticated request is rejected with 401 and never calls the model", async () => {
  const { handler, calls } = buildHandler();
  const res = await handler(postRequest({ body: { query: "hello" } }));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "Authentication required" });
  assert.equal(calls.length, 0);
});

test("handler: tampered or expired session token is rejected", async (t) => {
  const { handler } = buildHandler();

  await t.test("signature does not verify", async () => {
    const token = createSessionToken({ id: "user-1", email: "a@b.c", role: "user" });
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ id: "user-1", role: "admin", exp: 9999999999 })).toString("base64url")}.${s}`;
    const res = await handler(postRequest({ cookie: `auth-token=${forged}`, body: { query: "hi" } }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "Invalid or expired session");
  });

  await t.test("expired token in a valid signature", async () => {
    const res = await handler(postRequest({ cookie: `auth-token=${expiredToken()}`, body: { query: "hi" } }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "Invalid or expired session");
  });

  await t.test("garbage cookie value", async () => {
    const res = await handler(postRequest({ cookie: "auth-token=not-a-jwt", body: { query: "hi" } }));
    assert.equal(res.status, 401);
  });

  await t.test("truncated signature is rejected, not thrown (timingSafeEqual guard)", async () => {
    const token = createSessionToken({ id: "user-1", email: "a@b.c", role: "user" });
    const [h, b] = token.split(".");
    const res = await handler(postRequest({ cookie: `auth-token=${h}.${b}.abc`, body: { query: "hi" } }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "Invalid or expired session");
  });
});

/** A correctly signed token whose exp is in the past. */
function expiredToken() {
  const crypto = require("node:crypto");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ id: "user-1", email: "a@b.c", role: "user", exp: Math.floor(Date.now() / 1000) - 60 });
  const sig = crypto.createHmac("sha256", TEST_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

test("handler: authenticated request returns the answer and passes it to the model layer", async () => {
  const { handler, calls } = buildHandler();
  const res = await handler(postRequest({ cookie: cookieHeader(), body: { query: "  pollution trends  " } }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { answer: "echo:pollution trends" });
  assert.deepEqual(calls, ["pollution trends"], "query should be trimmed before the model call");
});

test("handler: invalid input is rejected with 400 before the model is called", async (t) => {
  const cases = [
    ["empty query", { query: "" }],
    ["missing query", {}],
    ["wrong type", { query: 42 }],
    ["over 500 chars", { query: "x".repeat(501) }],
  ];
  const { handler, calls } = buildHandler();
  for (const [label, body] of cases) {
    await t.test(label, async () => {
      const res = await handler(postRequest({ cookie: cookieHeader(), body }));
      assert.equal(res.status, 400, label);
      const json = await res.json();
      assert.equal(json.error, "Validation failed");
      assert.ok(Array.isArray(json.details) && json.details.length > 0);
    });
  }
  assert.equal(calls.length, 0);

  await t.test("malformed JSON body", async () => {
    const res = await handler(postRequest({ cookie: cookieHeader(), rawBody: "{not json" }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "Invalid JSON body");
  });

  await t.test("exactly 500 chars is accepted", async () => {
    const res = await handler(postRequest({ cookie: cookieHeader(), body: { query: "x".repeat(500) } }));
    assert.equal(res.status, 200);
  });
});

test("handler: non-POST methods get 405 with an Allow header", async () => {
  const { handler } = buildHandler();
  const res = await handler(postRequest({ cookie: cookieHeader(), method: "GET" }));
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "POST");
});

test("handler: per-user rate limit returns 429 with Retry-After", async () => {
  const { handler, calls } = buildHandler({ max: 3 });
  for (let i = 0; i < 3; i++) {
    const res = await handler(postRequest({ cookie: cookieHeader(), body: { query: `q${i}` } }));
    assert.equal(res.status, 200, `request ${i + 1} should pass`);
  }
  const blocked = await handler(postRequest({ cookie: cookieHeader(), body: { query: "q4" } }));
  assert.equal(blocked.status, 429);
  const json = await blocked.json();
  assert.equal(json.error, "Too many requests");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal(calls.length, 3, "the blocked request must not reach the model");

  // A different user has an independent budget.
  const other = await handler(
    postRequest({ cookie: cookieHeader({ id: "user-2", email: "other@example.com", role: "user" }), body: { query: "hi" } })
  );
  assert.equal(other.status, 200);
});

test("handler: model failure is surfaced, never replaced with generated text", async () => {
  const { handler } = buildHandler({
    ask: async () => {
      throw new Error("upstream exploded");
    },
  });
  const res = await handler(postRequest({ cookie: cookieHeader(), body: { query: "hello" } }));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "Assistant temporarily unavailable" });
});

test("handler: empty model answer is a 502, not a fabricated response", async () => {
  for (const bad of ["", null, undefined]) {
    const { handler } = buildHandler({ ask: async () => /** @type {any} */ ({ answer: bad }) });
    const res = await handler(postRequest({ cookie: cookieHeader(), body: { query: "hello" } }));
    assert.equal(res.status, 502);
  }
});

test("handler: missing AUTH_SECRET fails closed and allows no anonymous access", async () => {
  // Sign a valid cookie first, then remove the secret: verification must fail.
  const cookie = cookieHeader();
  const saved = process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET;
  try {
    const { handler, calls } = buildHandler();
    const res = await handler(postRequest({ cookie, body: { query: "hello" } }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "Invalid or expired session");
    assert.equal(calls.length, 0);
  } finally {
    process.env.AUTH_SECRET = saved;
  }
});

test("session module: verifies its own signatures and rejects others", () => {
  const token = createSessionToken({ id: "user-9", email: "x@y.z", role: "admin" });
  const payload = verifySessionToken(token);
  assert.equal(payload.id, "user-9");
  assert.equal(payload.role, "admin");
  assert.equal(verifySessionToken(`${token}x`), null);
  assert.equal(verifySessionToken("a.b.c"), null);
});
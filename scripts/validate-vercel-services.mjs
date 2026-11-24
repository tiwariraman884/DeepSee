import fs from "node:fs";
import assert from "node:assert/strict";

const root = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const names = Object.keys(root.services ?? {});
assert.deepEqual(names, ["frontend", "backend", "ml"]);

for (const [name, service] of Object.entries(root.services)) {
  assert.ok(fs.statSync(service.root).isDirectory(), `Missing service root: ${name}`);
  for (const b of service.bindings ?? []) {
    assert.equal(b.type, "service");
    assert.equal(b.format, "url");
    assert.ok(names.includes(b.service));
    assert.match(b.env, /^[A-Z][A-Z0-9_]*$/);
  }
}
assert.deepEqual(root.services.frontend.bindings, [
  { type: "service", service: "backend", format: "url", env: "BACKEND_URL" },
]);
assert.deepEqual(root.services.backend.bindings, [
  { type: "service", service: "ml", format: "url", env: "ML_URL" },
]);
assert.equal(root.services.ml.bindings, undefined);
assert.equal(root.services.ml.entrypoint, "main:app");
assert.ok(fs.existsSync("ml/main.py"));
assert.ok(fs.existsSync("backend/src/server.ts"));
assert.ok(fs.existsSync("frontend/src/app/api/assistant/route.ts"));
assert.ok(fs.existsSync("frontend/src/app/api/stack-health/route.ts"));

const rewrites = root.rewrites ?? [];
assert.equal(rewrites.at(-1)?.source, "/(.*)");
assert.equal(rewrites.at(-1)?.destination?.service, "frontend");
assert.ok(rewrites.some(x => x.source === "/api/assistant" && x.destination?.service === "frontend"));
assert.ok(rewrites.some(x => x.source === "/api/stack-health" && x.destination?.service === "frontend"));
assert.ok(rewrites.some(x => x.source === "/api/(.*)" && x.destination?.service === "backend"));
assert.ok(!rewrites.some(x => x.destination?.service === "ml"));
assert.ok(rewrites.findIndex(x => x.source === "/api/(.*)") < rewrites.length - 1);

const middleware = fs.readFileSync("frontend/src/middleware.ts", "utf8");
assert.match(middleware, /runtime:\s*["']nodejs["']/,
  "Vercel Services requires Node.js middleware, not the default Edge output");

const config = fs.readFileSync("frontend/next.config.mjs", "utf8");
assert.ok(!config.includes("localhost:5000"));
assert.ok(config.includes("async rewrites()"));
const backend = fs.readFileSync("backend/src/lib/mlWorker.ts", "utf8");
assert.ok(backend.includes("process.env.ML_URL"));
console.log("Vercel Services configuration and routing checks passed");

/**
 * Environment bootstrap — MUST be imported before any module that reads
 * process.env at module scope.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * `server.ts` used to call `dotenv.config()` as a statement in the middle of
 * its import block. That works in plain ESM but is a latent bug in this
 * codebase: the backend compiles to CommonJS, where every `import` statement
 * becomes a `require()` call emitted at the TOP of the module, in source
 * order, and the remaining statements run afterwards.
 *
 * The emitted order was therefore:
 *
 *   require("./lib/authMiddleware")   <-- line 30
 *   ...
 *   dotenv.config({ path: ... })      <-- line 46
 *
 * `lib/authMiddleware.ts` validates AUTH_SECRET at module scope, so it threw
 * "AUTH_SECRET or SESSION_SECRET must be set" before dotenv had a chance to
 * load the file — the backend could not boot at all. The same applies to
 * `routes/auth.ts`, which checks the secret at module scope too.
 *
 * Importing this module FIRST guarantees dotenv has run before any other
 * module is evaluated, because a module's side effects execute when it is
 * required — and this require is the first one emitted.
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Candidate .env locations, in priority order.
 *
 * The primary location is the repository root, because `server.ts` resolves
 * its env path as `path.resolve(__dirname, "../../.env")` where __dirname is
 * `<repo>/backend/src` — i.e. `<repo>/.env`.
 *
 * The others are fallbacks so the backend still boots when it is started from
 * a different working directory or when a per-backend .env is preferred.
 */
function candidatePaths(): string[] {
  const fromLib = path.resolve(__dirname, "../../../.env"); // <repo>/.env
  const fromCwd = path.resolve(process.cwd(), "../.env");    // <repo>/.env when cwd=<repo>/backend
  const local = path.resolve(process.cwd(), ".env");         // <repo>/backend/.env
  return [...new Set([fromLib, fromCwd, local])];
}

function loadEnv(): void {
  const candidates = candidatePaths();
  const found = candidates.find((p) => fs.existsSync(p));

  // `override: false` keeps any value already present in process.env — this
  // matters for the Jest suite, which sets AUTH_SECRET in jest.setup.ts and
  // must not have it shadowed by a developer's local .env.
  dotenv.config({ path: found ?? candidates[0], override: false });
}

loadEnv();

export {};

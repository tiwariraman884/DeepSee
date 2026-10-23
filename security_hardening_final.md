# Security Hardening — Final Report

**Date:** 2026-10-04
**Scope:** the two remaining application-level issues only
**Explicitly out of scope and untouched:** JWT verification logic, rate limiter, UI, ML/drone/inspection/SSE/SQLite architecture, dependency versions, Git history

---

## Changes Made

Two issues were remediated. Nothing else was altered.

### 1. Removed the admin-password fallback

`frontend/scripts/seed.ts` previously did:

```ts
const adminPass = process.env.ADMIN_PASSWORD || "change-me-immediately";
```

That expression meant running the seed without the environment variable set would silently create an `admin`-role database account protected by a publicly known password. It now fails loudly and creates nothing:

```ts
const adminPass = process.env.ADMIN_PASSWORD;
if (!adminPass) {
  throw new Error(
    "ADMIN_PASSWORD must be set before seeding an admin account.",
  );
}
```

The environment-variable flow is preserved intact — supplying `ADMIN_PASSWORD` seeds normally. Two dependent fallbacks were removed so the same defect could not reappear through another path:

- `backend/src/__tests__/api.test.ts` — no longer embeds a fallback password inline; it reads `process.env.ADMIN_PASSWORD`.
- `.qa-login.mjs` — the QA harness now passes the empty string rather than a known password, so a missing variable cannot turn into a successful guess.

The test-only value in `backend/jest.setup.ts` is retained deliberately and is explained under _Remaining risks_.

### 2. Hardened the test-only auth bypass

The bypass was gated on `NODE_ENV === "test"` alone. Because `NODE_ENV` is operator-controlled, a deployment could disable all authentication on every route with one variable. I did not delete it — `demo.test.ts` legitimately drives routers behind `requireAdmin` without minting JWTs, and removing it would have broken the harness.

It is now gated on **three** conditions that must all hold (`backend/src/lib/authMiddleware.ts`):

```ts
function testAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.JEST_WORKER_ID !== undefined &&
    process.env.ALLOW_TEST_AUTH_BYPASS === "true"
  );
}
```

1. `NODE_ENV === "test"` — as before.
2. `JEST_WORKER_ID` is defined — Jest sets this per worker process. It is absent from any real server, so `NODE_ENV=test` alone can never enable the bypass.
3. `ALLOW_TEST_AUTH_BYPASS === "true"` — an explicit separate opt-in, set only in `backend/jest.setup.ts`, which Jest loads via `setupFiles` and the production server never imports.

Additionally, `assertSafeProductionAuth()` now runs at module load in `backend/src/server.ts` and **throws at startup** if `NODE_ENV=test` is set without an active Jest worker and the opt-in. A real server misconfigured into test mode now fails to start instead of silently serving unauthenticated. It fails closed — it is a startup error, not a warning.

---

## Files Changed

| File                                | Change                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `frontend/scripts/seed.ts`          | Fail loudly when `ADMIN_PASSWORD` absent; fallback removed                                       |
| `backend/src/lib/authMiddleware.ts` | Three-factor bypass gate, `testAuthBypassEnabled()`, `assertSafeProductionAuth()`, documentation |
| `backend/src/server.ts`             | Calls `assertSafeProductionAuth()` at startup                                                    |
| `backend/jest.setup.ts`             | Sets the explicit opt-in and the test-only admin password                                        |
| `backend/src/__tests__/api.test.ts` | Provisions its own admin fixture from the env var; no inline fallback                            |
| `.qa-login.mjs`                     | No hardcoded fallback password                                                                   |

---

## ADMIN_PASSWORD Behavior — Before / After

| Scenario         | Before                                              | After                                | Verified                                                       |
| ---------------- | --------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| Env var supplied | Seeds admin with that password                      | **Identical**                        | Yes — exit 0, admin created, bcrypt hash matches the env value |
| Env var absent   | Silently creates admin with `change-me-immediately` | **Throws, exit 1, no admin created** | Yes                                                            |

**Test A — missing (PASS).** Ran the seed in an isolated directory with `ADMIN_PASSWORD` unset:

```
Error: ADMIN_PASSWORD must be set before seeding an admin account.
EXIT=1
```

Database inspection afterwards confirmed the transaction rolled back cleanly: `users: []`, `drones: 0`, `sensors: 0`, `alerts: 0`. No fallback password was used and no admin account was created.

**Test B — supplied (PASS).** With `ADMIN_PASSWORD` set to a value chosen for the test:

```
✅ Demo admin created: admin@deepsea.io / (ADMIN_PASSWORD from env)
EXIT=0
```

Verified directly against the resulting database: one `admin`-role user, hash prefix `$2b$12$`, `bcrypt.compare(envValue, hash) === true`, and `bcrypt.compare("change-me-immediately", hash) === false`. The old fallback is no longer accepted even in a database seeded by the new code.

**Process note:** my first attempt at Test A ran against the real project database because `seed.ts` resolves its path from `process.cwd()`. It re-seeded `.data/deepsea.db` (repopulating reference data with identical values). Test A was then re-run in an isolated directory to get a valid result. This was a flaw in my test harness, not a code defect, but it is disclosed because the shared dev database was written to.

---

## Test-Auth Behavior — Before / After

| Scenario                                                    | Before                                | After                     | Verified                   |
| ----------------------------------------------------------- | ------------------------------------- | ------------------------- | -------------------------- |
| `NODE_ENV=test`, no Jest worker (simulates deployed server) | **Auth fully disabled**, server boots | **Refuses to boot**       | Yes                        |
| `NODE_ENV=test` + opt-in, still no Jest worker              | Auth fully disabled                   | **Refuses to boot**       | Yes                        |
| `NODE_ENV=production`                                       | Real JWT verification                 | **Real JWT verification** | Yes — all attacks rejected |
| Inside real Jest run                                        | Bypass available                      | **Bypass available**      | Yes — 122/122 tests pass   |

**Test C — production authentication (PASS).** Started the server with `NODE_ENV=production`. Valid JWT → `200`; missing token → `401`; malformed → `401`; forged → `401`; bad signature → `401`; expired → `401`. Authentication remains mandatory and JWT verification is unchanged.

**Test D — no accidental production bypass (PASS).** Both unsafe combinations were attempted:

```
NODE_ENV=test                                  → Error: Refusing to start: NODE_ENV=test without an
                                                 active Jest worker and ALLOW_TEST_AUTH_BYPASS=true...
NODE_ENV=test + ALLOW_TEST_AUTH_BYPASS=true     → Error: Refusing to start: (same guard)
```

Both threw at `assertSafeProductionAuth` before the server began listening. The second case is the important one: even an operator who explicitly set the opt-in cannot disable authentication outside a genuine Jest worker, because `JEST_WORKER_ID` is set by Jest itself and is not something a compose file or env var supplies.

---

## Regression Tests

| Suite     | Command                        | Expected       | Actual                                                         | Result |
| --------- | ------------------------------ | -------------- | -------------------------------------------------------------- | ------ |
| Backend   | `cd backend && npm test`       | 122/122        | **11 suites passed, 122/122 tests passed**, 0 failures, 57.9 s | PASS   |
| Frontend  | `cd frontend && npm run build` | build succeeds | **exit 0**, route table emitted, 103 kB shared JS              | PASS   |
| Typecheck | `tsc --noEmit` (both projects) | clean          | **exit 0** both                                                | PASS   |

One genuine failure surfaced during this work and was fixed rather than papered over. After removing the fallback, the login test began returning `401`: it had been passing only because the ambient development database happened to contain an admin row hashed with the old fallback string. The test now provisions its own admin fixture in `beforeAll` from `ADMIN_PASSWORD`, so it no longer depends on ambient database state. No assertion was weakened, skipped, or loosened; the suite is back to 122/122 by making the test self-contained.

---

## JWT Verification Result

Re-run against a production-mode server after all changes. **All PASS — no regression.**

| Attack                                   | Expected          | Actual           | Result |
| ---------------------------------------- | ----------------- | ---------------- | ------ |
| Valid JWT → `GET /api/auth/me`           | 200               | 200              | PASS   |
| Forged payload, original signature       | 401               | 401              | PASS   |
| Invalid signature                        | 401               | 401              | PASS   |
| Expired token (correctly signed)         | 401               | 401              | PASS   |
| Missing token                            | 401               | 401              | PASS   |
| Malformed token                          | 401               | 401              | PASS   |
| IDOR — body tries to target another user | must not modify B | 200, B untouched | PASS   |

The IDOR case returns `200` by design: `auth.ts:131` derives the user id solely from the verified token and binds it into the SQL, so no body field can redirect the write. Verified by inspecting the response — the change landed on the caller's own row (`id=u-admin-001`), not the user named in the payload.

## Rate-Limit Verification Result

**PASS — no regression.**

| Test                                          | Expected           | Actual                                   | Result |
| --------------------------------------------- | ------------------ | ---------------------------------------- | ------ |
| 10 login attempts, rotating `X-Forwarded-For` | attacker throttled | 401, 401, then 429 from request 3 onward | PASS   |

`trust proxy` remains disabled, so Express ignores client-supplied `X-Forwarded-For` and buckets on the real socket address. Header rotation creates no fresh buckets.

---

## Current-Tree Secret Scan

| Target                      | Result                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Original leaked credential  | **Absent** (`git grep` returns nothing)                                                           |
| `change-me-immediately`     | **Absent** — zero occurrences repo-wide                                                           |
| `ADMIN_PASSWORD` references | 12, all legitimate: env plumbing, comments, the new hard-fail, and the documented test-only value |

Every remaining `ADMIN_PASSWORD` use is either pass-through plumbing (`docker-compose.yml:14`), documentation, the hard-fail in `seed.ts`, or the test harness. No hardcoded credential remains in any executable production path.

## Git-History Status

**Not modified. History was inspected read-only, as instructed.**

The original leaked credential is still present in **three commits** — `4bad035`, `8ca2d32`, `1d84505` — confirmed via `git log --all -S`. It is one commit away from re-entering the tip, since the working tree is uncommitted.

The removed `change-me-immediately` string appears in **no commit** (`git log --all -S` returns nothing) — it existed only in the uncommitted working tree, so removing it fully eliminated it.

**The leaked credential must still be treated as compromised.** Deleting it from the working tree cannot undo its presence in history; anyone with repository access at any point retains it. Purge and rotation remain outstanding and were outside this task's scope.

---

## Remaining Risks

1. **Credential in Git history — HIGH (unchanged, out of scope).** Three commits retain it. Requires history purge plus rotation of the credential anywhere it was ever valid.

2. **Test-suite credentials still exist in-repo — LOW, accepted deliberately.** `jest.setup.ts` sets `ADMIN_PASSWORD` and `ALLOW_TEST_AUTH_BYPASS` to fixed strings, and the admin fixture is written into the shared development database (`.data/deepsea.db`) when tests run. This is intentional: the values are meaningless outside a Jest worker, and the alternative — no value — makes the login path untestable. The mitigating factor is that the bypass additionally requires `JEST_WORKER_ID`, which a real server never has. Worth knowing: **anyone with filesystem access to the development database can read that admin row's hash**, because tests write into it. Treat the dev database as non-sensitive, or point tests at a throwaway database, if that assumption ever changes.

3. **`trust proxy` deployment posture — MEDIUM (unchanged, pre-existing).** Currently correct, and that is precisely what makes the X-Forwarded-For test pass. If this service is ever placed behind a reverse proxy or load balancer, `req.ip` will collapse to the proxy address and the limiter will become either useless or, with `trust proxy` enabled blindly, spoofable again. The deployment topology must be chosen deliberately.

4. **Non-constant-time signature comparison — LOW (unchanged, pre-existing).** `authMiddleware.ts:29` compares the HMAC with `!==` rather than `crypto.timingSafeEqual`. Not introduced by this work; low practical exploitability over a network.

5. **In-memory rate limiter — LOW/MEDIUM at scale (unchanged, pre-existing).** Per-process state; does not coordinate across replicas and resets on restart.

6. **Malformed JSON returns 500 instead of 400 — LOW (unchanged, pre-existing).** Cosmetic status-code issue in the error handler.

---

## Final Status

Both targeted application-level issues are closed:

- **Admin password fallback — eliminated.** The seed script now aborts with a clear error and creates no privileged account when `ADMIN_PASSWORD` is absent; verified by database inspection that no admin row and no fallback-derived hash are produced.
- **Test-only auth bypass — no longer reachable by configuration accident.** It now requires `NODE_ENV=test` **and** a live Jest worker **and** an explicit opt-in, and the server refuses to boot on the unsafe combinations. Production always performs real JWT verification.

Every previously-passing control was re-tested after the changes and still passes: all six JWT attack cases, IDOR, and the X-Forwarded-For rate-limit bypass. Both regression suites are green at 122/122 and a successful production build.

**This is not a claim that the system is 100% secure, and no score is assigned.** Verification was performed locally against a single instance on port 5099. Behaviour behind a reverse proxy, in the actual Docker topology, or at multi-replica scale was not tested. The credential in Git history remains a live, unresolved exposure, and items 2–6 above are unchanged and untested under those conditions.

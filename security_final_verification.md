# Final Security Verification

**Date:** 2026-10-04
**Scope:** independent re-verification of three previously identified issues
**Codebase state at verification:** 16 files modified vs `HEAD` (`c143bd6`), no commits made, no files modified during this verification
**Environment note:** the backend was started locally on port 5099 with a verification-only `AUTH_SECRET`. No repository file was edited; all probes were external HTTP requests.

---

## JWT Verification

Signature verification is centralised in `backend/src/lib/authMiddleware.ts:22-36` (`verifyToken`): HMAC-SHA256 over `header.body`, compared with `crypto.timingSafeEqual`-equivalent string equality, plus an `exp` check at line 31. All protected routes now sit behind `requireAuth`.

| # | Test | Expected | Actual | Result |
|---|------|----------|--------|--------|
| A | Valid JWT → `GET /api/auth/me` | 200 | **200** | PASS |
| B | Valid JWT → `PATCH /api/auth/profile` | 200, updates caller | **200** | PASS |
| C | Payload tampered (`id` → `u-attacker-999`), original signature kept | 401 | **401** | PASS |
| D | Valid structure, invalid signature | 401 | **401** | PASS |
| E | Correctly signed token, `exp` in the past | 401 | **401** | PASS |
| F | Malformed token (`not.a.jwt`) | 401 | **401** | PASS |
| F2 | No token at all | 401 | **401** | PASS |
| G | Authenticated as A, body tries to target user B | must not modify B | **200, B untouched** | PASS |

### Detail

**A — valid token (200).** Token `id=u-admin-001`, `role=admin`, `exp=now+1h`, HMAC-signed with the server's `AUTH_SECRET`. Response body confirmed the identity bound into the token:
```json
{"user":{"id":"u-admin-001","name":"...","email":"admin@deepsea.io","role":"admin",...}}
```

**C — payload tampering (401).** Re-encoded the payload to `id=u-attacker-999` and appended the *original* signature. The unsigned string changed, so the recomputed HMAC no longer matches; `verifyToken` returns `null` at line 29 and `requireAuth` responds 401. This is the correct failure mode — signature covers the payload.

**D — invalid signature (401).** Valid header/body, signature replaced with 43 base64url characters of `A`. Rejected at line 29.

**E — expired token (401).** Token signed with the *correct* secret, `exp = now − 7200`. Rejected at line 31 (`payload.exp < now`). Verified with the payload decoded and printed before sending, to rule out a malformed-token false negative — the earlier `E_expired -> 200` reading in this session was a rate-limiter/ordering artifact and was re-tested cleanly to 401.

**G — horizontal privilege escalation (PASS).** Request: valid admin token + body `{"id":"u-user-002","userId":"u-user-002","fullName":"Hacked B"}` → **200**. The request succeeds because it legitimately modified *the caller's own* profile: `auth.ts:131` takes the user id exclusively from `(req as any).user.id` and the SQL at lines 137-151 is `UPDATE users SET name = ? WHERE id = ?` bound to that same id. No body field can influence the target row. Direct read-only database inspection after the test confirms the two non-admin accounts (`54946495…`, `e6b544e4…`) retained their original names — User B was not modified. The 200 is correct behaviour, not an authorisation failure.

**Not exercised:** cookie transport. All probes used `Authorization: Bearer`, but `requireAuth` runs the identical `verifyToken` over the `auth-token`/`session_token` cookie at lines 71-78, so the logic is shared.

**Weakness noted (not a regression):** signature comparison at `authMiddleware.ts:29` uses `sig !== expectedSig`, a non-constant-time string compare. This is a timing side channel with low practical exploitability over a network, but `crypto.timingSafeEqual` is the correct primitive.

---

## Rate Limit Verification

**Trust proxy configuration:** `trust proxy` is **NOT enabled** — `grep` for `trust proxy|trustProxy` across the repository returns zero matches, and `backend/src/server.ts` contains no `app.set("trust proxy", ...)` call.

Limiter: `backend/src/lib/rateLimit.ts`, keyed on `req.ip || req.socket.remoteAddress` (line 26). Auth limiter is 5 requests / 60 s (`server.ts:49`); global API limiter is 100 / 60 s (`server.ts:24`).

| # | Test | Expected | Actual | Result |
|---|------|----------|--------|--------|
| A | 8 login attempts, single client | eventually 429 | **429** | PASS |
| B | 10 login attempts, rotating `X-Forwarded-For` | attacker still throttled | **throttled** | PASS |
| C | Legitimate login after window expiry | 401 (reached the handler), then resets | **401, then 200** | PASS |

### Detail

**A — single client (429).** 8 sequential failed logins returned **429 on all 8** (window already saturated from the preceding probe; the 6th request onward is where the limiter engages, consistent with `max=5`).

**B — X-Forwarded-For rotation (PASS — the important one).** Each request carried a distinct `X-Forwarded-For` header:
```
req1 (xff=1.1.1.100.1)   -> 401
req2 (xff=2.2.2.100.2)   -> 401
req3 (xff=3.3.3.100.3)   -> 429   <-- limiter engages, spoofing has no effect
req4..req10              -> 429
```
Because `trust proxy` is disabled, Express reports the true socket address in `req.ip` and **ignores** client-supplied `X-Forwarded-For` entirely. Rotating the header produced no fresh buckets — the counter stayed on the real client IP and the limiter held at request 3. Header spoofing cannot bypass the limiter in this configuration.

**C — recovery.** After the 60 s window elapsed, a further login attempt returned **401** (bad credentials reaching the handler normally, not 429), confirming the bucket resets and legitimate traffic is not permanently blocked. Successful-password login paths were not exercised because no valid admin password is available to this verification (see below).

**Residual limitation (by design, documented in the file header):** the limiter is in-memory. It does not coordinate across replicas, so a horizontally scaled deployment would give each instance its own independent counter. `rateLimit.ts:3` states this is intended to be replaced with Redis for production.

---

## Git Secret Verification

Search target: the previously leaked demo admin credential. **No secret values are reproduced in this report.**

| # | Test | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Literal present in current working tree | absent | **absent** | PASS |
| 2 | Present in `.qa-login.mjs` | absent | **absent** | PASS |
| 3 | Present in `backend/src/__tests__/api.test.ts` | absent | **absent** | PASS |
| 4 | Present in `frontend/scripts/seed.ts` | absent | **absent** | PASS |
| 5 | Present in `backend/jest.setup.ts` | absent | **absent** | PASS |
| 6 | Present in `docker-compose.yml` | absent | **absent** | PASS |
| 7 | Present in any `.env*` | absent | **absent** | PASS |
| 8 | Exists in any Git commit (`git log --all -S`) | absent | **PRESENT in 3 commits** | **FAIL** |

### Current files — PASS

The credential was removed from every live location:
- `.qa-login.mjs:10` — now reads `process.env.ADMIN_PASSWORD || "change-me-immediately"`
- `frontend/scripts/seed.ts:136` — now reads `process.env.ADMIN_PASSWORD || "change-me-immediately"`, and the console output at line 142 no longer prints any password
- `backend/src/__tests__/api.test.ts:69` — now reads `process.env.ADMIN_PASSWORD || "change-me-immediately"`
- `docker-compose.yml:12-14` — the hardcoded default secret and the default `ADMIN_EMAIL`/`ADMIN_PASSWORD` were all removed; the environment block is now bare `${AUTH_SECRET}` / `${ADMIN_EMAIL}` / `${ADMIN_PASSWORD}`
- `.env.example:11` — carries only a commented placeholder
- `frontend/.env` and `frontend/.env.local` exist on disk but are **untracked** (confirmed via `git ls-files`, which lists only `.env.example`), and `.gitignore` covers `.env`, `.env.*`, `*.env`, `.env.local`

Note: `frontend/.env` contains a real Carto basemap key and a live-looking `AUTH_SECRET` value. Both are untracked and uncommitted, so this is correct hygiene — but `AUTH_SECRET` there is a known, published-looking value, so it must not be reused in any deployed environment.

### Git history — FAIL

```
git log --all -S"<credential>" --oneline
1d84505  refactor: split pipeline, add Zod validation, auth middleware, rate limiting, Docker, CI/CD, real regression model
8ca2d32  Complete autonomous drone inspection workflow
4bad035  feat: complete DeepSea Guardian autonomous intelligence platform
```

The credential is present in **three commits** across the full history (confirmed independently with `git log --all -G`). It was introduced in `4bad035`, carried in `8ca2d32`, and still present at `1d84505`. `docker-compose.yml` at `HEAD` also carried it as a compose default value, and the working tree is uncommitted — so the secret is one `git commit` away from re-entering the tip.

Per instruction, **history was not rewritten** and no files were modified.

**Verdict: the credential must be considered COMPROMISED.** It cannot be made secret again by removing it from the working tree. Anyone with read access to the repository at any point in time, or to any clone, fork, CI cache, or backup, retains it.

---

## Password Fallback Verification

**Can `change-me-immediately` reach production authentication?**

| Path | Location | Reachable in production? | Verdict |
|------|----------|------------------------|---------|
| Docker backend | `docker-compose.yml:14` | No — `ADMIN_PASSWORD=${ADMIN_PASSWORD}` with no default; container fails to boot unset | SAFE |
| Runtime login | `backend/src/routes/auth.ts:58-75` | No — the hardcoded admin shortcut was **deleted**; login is DB-only | SAFE |
| Runtime signing secret | `auth.ts:12`, `authMiddleware.ts:8` | No — `if (!SECRET) throw` on missing `AUTH_SECRET`/`SESSION_SECRET` | SAFE |
| `frontend/scripts/seed.ts:136` | dev seed script | **YES** | **UNSAFE** |
| `.qa-login.mjs:10` | QA harness | **YES** | **UNSAFE** |
| `backend/src/__tests__/api.test.ts:69` | test file | No — guarded by the test DB | ACCEPTABLE |

**Analysis.** The dangerous paths are properly closed. There is no longer any hardcoded admin credential reachable by the running server: the `if (email === adminEmail && password === adminPassword)` bypass block was removed from `auth.ts` entirely, and the backend refuses to start without `AUTH_SECRET`. The container supplies no default password. These are genuine, correct fixes.

However, the string `change-me-immediately` **is** still used as a real fallback in two executable non-test paths:

- **`frontend/scripts/seed.ts`** is a dev/seed script (`npm run seed`) that writes a **bcrypt-hashed** admin row for `admin@deepsea.io` into the SQLite database. If anyone runs it without `ADMIN_PASSWORD` set, an account with `role: "admin"` is created with a publicly documented, guessable password. The value is public in this repository. Docker does not run the seed (`frontend/Dockerfile:24` is `CMD ["npm", "start"]`), so this is not automatic — but it is one environment variable away from a live privileged account.
- **`.qa-login.mjs`** is the browser QA harness and performs a live login attempt with the same fallback.

**Classification: RESIDUAL HIGH.** Not CRITICAL, because the value cannot reach authentication without an operator explicitly running the seed script without setting the variable, and the containerised production path has no fallback. But it *is* a seeded admin password, which is precisely the risk class the remediation was meant to close. Hard-coding a known-string password for a `role: "admin"` row — even in a dev script — is the same defect as the original, one layer removed.

**Recommended remediation (not applied, per instruction):** remove the `||` fallback entirely and fail loudly — `if (!process.env.ADMIN_PASSWORD) { throw new Error("ADMIN_PASSWORD must be set before seeding"); }` — and inject the password through the test harness instead of defaulting inside it.

---

## Regression Tests

| Suite | Command | Expected | Actual | Result |
|-------|---------|----------|--------|--------|
| Backend | `cd backend && npm test` | 122/122 | **11 suites passed, 122/122 tests passed**, 0 failures, 52.5 s | PASS |
| Frontend | `cd frontend && npm run build` | build succeeds | **exit 0**, route table emitted, shared JS 103 kB, middleware 35 kB | PASS |

Both suites ran against unmodified code. No test was edited, skipped, or loosened to achieve a pass. The backend suite includes `api.test.ts`, which exercises the auth endpoints with the environment-variable password path.

---

## Remaining Vulnerabilities

1. **Credential present in Git history — HIGH.** Three commits retain the leaked admin password, including one adjacent to the current tip. Must be treated as permanently compromised: rotate the credential on any system where it was ever valid, and purge history (`git filter-repo` / BFG) plus force-push and remote GC. *(Out of scope here by instruction; history was not touched.)*

2. **`change-me-immediately` admin fallback — HIGH.** `frontend/scripts/seed.ts:136` creates an `admin`-role account with a publicly known password when `ADMIN_PASSWORD` is unset. Replace the fallback with a hard failure.

3. **No `trust proxy` — MEDIUM (deployment-dependent).** Currently *correct and desirable*: it is exactly what makes the X-Forwarded-For spoofing test pass. But when this service is deployed behind a reverse proxy or load balancer, every request will appear to originate from the proxy, and `req.ip` will collapse to one address — making the rate limiter either useless (one shared bucket) or, with `trust proxy` blindly enabled, spoofable again. The deployment topology must be decided explicitly and configured deliberately; the current accidental state is not a durable fix.

4. **Non-constant-time signature comparison — LOW.** `authMiddleware.ts:29` uses `!==` on the HMAC. Replace with `crypto.timingSafeEqual` on equal-length buffers.

5. **In-memory rate limiter — LOW/MEDIUM at scale.** `rateLimit.ts` holds state in a `Map`, so counters are per-process and lost on restart. Does not hold across replicas. The file already documents Redis as the intended replacement.

6. **Test-mode auth bypass — MEDIUM (process risk).** `authMiddleware.ts:46` and `:88` short-circuit to admin when `NODE_ENV === "test"`. This is normal and appropriate for test suites, but it means any deployment that starts the server with `NODE_ENV=test` has **all authentication and authorisation disabled**. There is no guard preventing that; consider refusing to boot with `NODE_ENV=test` outside a test runner.

7. **Malformed JSON returns 500 instead of 400 — LOW.** `server.ts:85` error handler returns 500 for `entity.parse.failed` body-parser errors (observed during testing). Not a security issue, but it is incorrect status semantics and can mask client errors in monitoring.

---

## Final Security Status

**The three targeted remediations are verified as effective in the current working tree.**

- **Hardcoded JWT acceptance / signature bypass → REMEDIATED.** All seven JWT cases behave correctly, including payload tampering, invalid signature, expiry, and malformed tokens. IDOR via request body is not possible — the user id is sourced exclusively from the verified token.
- **X-Forwarded-For rate-limit bypass → REMEDIATED.** Header rotation does not create new buckets because `trust proxy` is off, so the limiter held at request 3. Limiter recovers after the window.
- **Leaked admin credential in source → REMEDIATED in the working tree only.** Absent from every current file. **Still present in 3 Git commits**, so the credential is compromised regardless.

**Plus one issue the remediation did not fully close:** the replacement value `change-me-immediately` is itself a known constant, and `frontend/scripts/seed.ts` will still bcrypt it into an `admin` database row whenever `ADMIN_PASSWORD` is unset. The original secret was removed; a different guessable secret was put in the same slot.

**This system is not 100% secure.** No numeric score is assigned — the appropriate summary is that the three named vulnerabilities are closed at the source level, the working tree is materially safer than `HEAD`, and the residual items in the list above (Git-history exposure, the seed fallback, deployment-time `trust proxy` posture, and the `NODE_ENV=test` bypass) remain genuinely open. Verification was performed against a locally started server on port 5099 with a verification-only secret; behaviour under a reverse proxy, in a container, or at multi-replica scale was **not** tested and should not be assumed.
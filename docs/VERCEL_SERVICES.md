# DeepSea Guardian — Vercel Services review candidate

The root vercel.json separates frontend, backend, and ml under one project.

- frontend: public at / and Next.js-owned /api/assistant and /api/stack-health.
  Has a private backend binding as runtime BACKEND_URL, used by stack-health.
- backend: public at /api/(.*), where Express already owns /api/* routes.
  Has a private ml binding as runtime ML_URL. Vercel's Express preset loads
  `backend/src/app.ts`, whose default export is the app. `app.ts` exports
  `createApp()`, and both entrypoints share it: `src/server.ts` (the long-running
  server used by npm run dev and Docker) calls createApp() and adds listen() plus
  the background pipeline. Do not point the service entrypoint at server.ts — it
  only calls listen() and exports nothing, so the function handler would fail.
- ml: FastAPI HTTP inference (ml/main.py: /health, /predict, /forecast,
  /classify); private, no public rewrite.

Do not manually set BACKEND_URL or ML_URL in Vercel project variables.
Bindings are injected at runtime, not during builds. Set real AUTH_SECRET
and other application secrets separately. All browser requests use same-origin
/api URLs. The former localhost Next.js proxy is removed to avoid intercepting
top-level Services routing: next.config.mjs adds no proxy when VERCEL=1, and
plain `next dev` keeps proxying to BACKEND_URL for backend-only work.

Use recent Vercel CLI. From the repository root: vercel dev --local
Test /, /api/health, /api/stack-health, authenticated POST /api/assistant,
prediction, forecast, classification and SSE. Validate the config with
`node scripts/validate-vercel-services.mjs` and the ML adapter with
`python ml/test_http.py`.

## Not yet production-ready
- SQLite .data/deepsea.db is local and non-durable on Vercel. Accounts,
  telemetry and incidents need a managed database and data-access migration.
- EventBus, SSE clients, mission timers, and scenario maps are in memory.
  Serverless instances cannot guarantee sharing them or completing background
  operations. Use a durable queue/workflow and persistent state.
- ML requirements omit large PyTorch packages. The HTTP model service falls
  back to the existing sklearn classifier. Train/use PyTorch locally via
  pip install -r ml/requirements-training.txt. Validate remote memory/size.
- Physical sensor validation and real deep-sea deployment are not verified.

This is a review candidate: service names, public paths and bindings must
be confirmed before merging. Cloud deployment has not been verified.

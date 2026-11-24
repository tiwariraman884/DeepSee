# DeepSea Guardian — Vercel Services review candidate

The root vercel.json separates frontend, backend, and ml under one project.

- frontend: public at / and Next.js-owned /api/assistant and /api/stack-health.
  Has a private backend binding as runtime BACKEND_URL, used by stack-health.
- backend: public at /api/(.*), where Express already owns /api/* routes.
  Has a private ml binding as runtime ML_URL.
- ml: FastAPI HTTP inference; private, no public rewrite.

Do not manually set BACKEND_URL or ML_URL in Vercel project variables.
Bindings are injected at runtime, not during builds. Set real AUTH_SECRET
and other application secrets separately. All browser requests use same-origin
/api URLs. The former localhost Next.js proxy is removed to avoid intercepting
top-level Services routing.

Use recent Vercel CLI. From the repository root: vercel dev --local
Test /, /api/health, /api/stack-health, authenticated POST /api/assistant,
prediction, forecast, classification and SSE. Local npm run dev:frontend
no longer provides the previous localhost backend proxy.

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

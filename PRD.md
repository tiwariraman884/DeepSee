# DeepSea Guardian — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Product** | DeepSea Guardian (DeepSee) |
| **Version** | 1.0 |
| **Status** | v1.0 feature-complete; V1.1 planning |
| **Last updated** | 2026-10-23 |
| **Owner** | Ocean Intelligence Platform Team |
| **License** | MIT |

---

## 1. Overview

DeepSea Guardian is an **AI-powered ocean pollution and biodiversity monitoring platform**. It acts as an automated mission-control center that ingests water-quality telemetry from ocean sensors and IoT buoys, runs machine-learning inference to detect pollution events in real time, raises alerts on a live dashboard, and dispatches autonomous inspection drones to the hotspot for visual confirmation.

The product has three cooperating layers:

1. **Frontend** — Next.js 15 mission-control dashboard (live KPIs, maps, reports, species scanner).
2. **Backend** — Express + TypeScript services: REST API, SSE streaming, event bus, ingestion pipeline, SQLite persistence.
3. **ML Engine** — Python worker processes holding models in RAM: Isolation Forest (anomaly detection), MobileNetV3-Small (species classification), Ridge polynomial regression (pollution spread forecast).

## 2. Problem Statement

- Over 70% of the planet is ocean, yet more than 80% of deep-sea area is effectively unmonitored.
- Oil spills and chemical leaks often go unnoticed for days or weeks, by which time the plume has spread.
- Marine species are harmed before any response can be organized.
- Sending crewed research vessels to inspect suspected sites is slow and expensive.

**Goal:** reduce the time from "abnormal sensor reading" to "confirmed, geolocated, evidence-backed incident report" from days to minutes.

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Fast anomaly detection | P95 time from ingest to alert | **< 2 s** |
| Low-latency ML inference | Per-reading prediction latency (warm worker) | **1–5 ms** |
| Reliable ingestion | Ingest success rate under burst load | **≥ 99.5%** |
| Operator actionability | Incidents with attached drone imagery + PDF report | **≥ 90%** |
| Forecast usefulness | 6-hour spread forecast generated per active event | **100%** |
| Accessibility | WCAG 2.1 AA on core operator screens | **Pass (axe-core, 0 critical)** |
| Uptime | Dashboard + API availability | **99.5% monthly** |

### Non-goals (v1.0)

- Real-time control of ROV/drone hardware over the open internet (see §10, `docs/vision/rov-integration.md` for the integration contract).
- Multi-tenant SaaS billing and organization isolation.
- Predictive modeling of ocean currents from live hydrodynamic data (forecasts are trend models, not physical simulators).
- Production-scale time-series storage (SQLite now; InfluxDB/TSDB is a V1.1+ item).

## 4. Target Users & Personas

| Persona | Needs | Primary screens |
|---|---|---|
| **Mission Operator** | See what is wrong right now, dispatch a drone, acknowledge alerts | Dashboard, Alerts, Drones |
| **Marine Scientist / Analyst** | Inspect telemetry history, confirm species, export incident evidence | Sensors, Biodiversity/Species, Reports |
| **Response Coordinator** | Read the incident PDF, understand spread trajectory, act on risk | Pollution detail, Risk, Incident Reports |
| **System Administrator** | Manage users, thresholds, demo scenarios, system health | Settings, System Intelligence, Status |
| **Field Engineer (device)** | Register sensors, push readings/diagnostics with device credentials | `/api/sensors/ingest`, `/api/sensors/diagnostics` |
| **Public Visitor** | Learn about the mission, check availability, read pricing/FAQ | Public pages: About, Features, Innovation, Roadmap, Blog |

## 5. Core User Journeys

### J1 — Detect and respond to a chemical spill (primary demo flow)
1. Sensor buoys stream telemetry (pH, dissolved oxygen, temperature, salinity, turbidity) to `POST /api/sensors/ingest`.
2. Reading is queued on the **EventBus**, consumed by the sensor pipeline, and scored by the ML worker (Isolation Forest).
3. If the score crosses the anomaly threshold, a `pollution_events` record and an `alerts` record are created.
4. The event is pushed to all connected browsers over SSE (`GET /api/sensors/stream`) — no polling, no refresh.
5. Operator clicks **Dispatch Nearest Drone** → the nearest available drone is selected by geodistance and assigned an inspection mission.
6. Drone frames arrive via the vision pipeline, are stored as `vision_frames`, and an incident report (HTML + PDF) is generated.
7. Operator downloads `GET /api/reports/incidents/:inspectionId/pdf`.

### J2 — Forecast spread and assess risk
1. Operator opens a pollution event detail and selects severity + trend.
2. `POST /api/pollution/forecast` returns a +1h…+6h severity trajectory (Ridge polynomial regression).
3. Risk page combines trajectory with zone data to rank affected areas.

### J3 — Identify a marine species
1. Operator uploads an image or selects a 1-click sample on the Biodiversity page.
2. `POST /api/species/classify` runs MobileNetV3-Small (224×224, ImageNet-pretrained, transfer-learned) in the warm species worker.
3. UI shows species name, confidence %, and reference data from the species catalogue.

### J4 — Live ROV / camera inspection
1. Operator configures a vision source via `POST /api/vision/source` (UVC camera, fixture, or ROV stream).
2. Frames are preprocessed, quality-scored, and persisted; `GET /api/vision/frames` lists them and `/file` serves the image.
3. `GET /api/vision/status` and `/rov/status` report capture health.

### J5 — Onboard a new sensor device
1. Device authenticates with a device credential (`deviceAuth`) on ingest/diagnostics endpoints.
2. Device registry records the device and provenance metadata.
3. Readings become visible in `/api/sensors` and dashboard KPIs immediately.

## 6. Functional Requirements

Priorities: **P0** = v1.0 required, **P1** = important, **P2** = nice-to-have.

### 6.1 Authentication & User Management — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-AUTH-1 | Email + password signup/login (`POST /api/auth/signup`, `/login`) with bcrypt hashing | P0 |
| FR-AUTH-2 | Session token in **httpOnly cookie**; `GET /api/auth/me` returns the current user + settings | P0 |
| FR-AUTH-3 | Logout clears the session cookie (`POST /api/auth/logout`) | P0 |
| FR-AUTH-4 | Profile read/update (`PATCH`/`PUT /api/auth/profile`) | P1 |
| FR-AUTH-5 | Role model: `user` vs `admin`; admin-only routes enforced server-side (`requireAdmin`) | P0 |
| FR-AUTH-6 | Auth endpoints rate-limited to **5 req/min/IP**; general API to **100 req/min/IP** (SSE exempt) | P0 |
| FR-AUTH-7 | Startup guard refuses unsafe production auth config (`assertSafeProductionAuth`) | P0 |
| FR-AUTH-8 | Forgot-password UI exists; email delivery is **not** wired in v1.0 | P2 |
| FR-AUTH-9 | SSO / MFA | P2 |

### 6.2 Sensor Ingestion & Real-Time Pipeline — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-ING-1 | `POST /api/sensors/ingest` accepts validated telemetry (Zod) from registered devices | P0 |
| FR-ING-2 | Device-authenticated endpoints (`ingest`, `diagnostics`) reject unregistered/revoked devices | P0 |
| FR-ING-3 | Readings pass through an **EventBus** before persistence to absorb bursts | P0 |
| FR-ING-4 | Sensor pipeline stages: **Consumer → Dispatcher → Inspector** initialized at boot | P0 |
| FR-ING-5 | Anomalous readings trigger inspection simulation and drone dispatch decisions | P0 |
| FR-ING-6 | `GET /api/sensors` lists sensors with status and data provenance | P0 |
| FR-ING-7 | `GET /api/sensors/readings/:id` returns a time series for one sensor | P0 |
| FR-ING-8 | `GET /api/sensors/pipeline-stats` exposes queue depth, throughput, drop counts | P1 |
| FR-ING-9 | `POST /api/sensors/predict` performs on-demand prediction for arbitrary telemetry | P0 |
| FR-ING-10 | `POST /api/sensors/diagnostics` accepts device self-diagnostics/battery/health | P1 |

### 6.3 Live Streaming (SSE) — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-SSE-1 | `GET /api/sensors/stream` streams telemetry, alerts, and pipeline events to the browser | P0 |
| FR-SSE-2 | `GET /api/sensors/live` provides a lightweight live feed | P1 |
| FR-SSE-3 | Client reconnects automatically; server tracks connection stats (`getStats`) | P0 |
| FR-SSE-4 | SSE connections do not consume the shared per-IP rate-limit budget | P0 |
| FR-SSE-5 | Dashboard KPIs update without page refresh (`useLiveKpis`) | P0 |

### 6.4 ML Anomaly Detection & Forecasting — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-ML-1 | Isolation Forest model loaded into RAM by a long-lived Python worker | P0 |
| FR-ML-2 | Warm-worker prediction latency 1–5 ms; per-request Python spawn is fallback only | P0 |
| FR-ML-3 | `POST /api/pollution/forecast` returns +1h…+6h severity trajectory | P0 |
| FR-ML-4 | Demo scenario endpoints let operators simulate clean baseline vs. chemical spill (`POST /api/demo/emergency-scenario`, admin only) | P0 |
| FR-ML-5 | Graceful degradation: if the ML worker fails, API falls back to one-shot execution and logs warnings | P0 |
| FR-ML-6 | `GET /api/health` reports `mlWorker.ready` | P0 |
| FR-ML-7 | Ledger of scenario/inspection progress (`GET /api/demo/scenario/:id`, `/active-mission`) | P1 |

### 6.5 Pollution Events & Alerts — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-POL-1 | `GET /api/pollution` lists events with severity, status, location | P0 |
| FR-POL-2 | `GET /api/pollution/:id` returns full event detail incl. trajectory | P0 |
| FR-ALT-1 | `GET /api/alerts` lists alerts with filtering and total counts | P0 |
| FR-ALT-2 | Alerts carry severity + metadata; unresolved alerts counted in dashboard KPI | P0 |
| FR-ALT-3 | Operator can resolve/acknowledge alerts (PATCH semantics on alert record) | P1 |

### 6.6 Drone Fleet Management — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-DRN-1 | `GET /api/drones` lists fleet with status, readiness, and position | P0 |
| FR-DRN-2 | `GET /api/drones/:id` returns drone detail and history | P0 |
| FR-DRN-3 | Nearest-drone selection uses geodistance + availability (`droneSelection`) | P0 |
| FR-DRN-4 | Dispatch attaches an inspection mission with ETA and target sector | P0 |
| FR-DRN-5 | `GET /api/drones/inspections/history` lists completed inspections | P1 |
| FR-DRN-6 | Live drone telemetry pushes to map over SSE | P1 |
| FR-DRN-7 | Actual command-and-control of hardware | P2 (see §10) |

### 6.7 Species Classification & Biodiversity — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-SPC-1 | `GET /api/species` returns species catalogue (conservation status, habitat) | P0 |
| FR-SPC-2 | `POST /api/species/classify` accepts base64 image, returns name + confidence | P0 |
| FR-SPC-3 | 1-click test samples available in UI | P1 |
| FR-SPC-4 | Low-confidence results must be visibly flagged, never presented as certain | P0 |
| FR-SPC-5 | Warm species worker; fallback to one-shot Python if worker start fails | P0 |

### 6.8 Vision / ROV Inspection — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-VIS-1 | `GET /api/vision/status` reports capture source health and frame rate | P0 |
| FR-VIS-2 | `GET /api/vision/frames` + `/frames/:frameId` + `/frames/:frameId/file` serve captured frames | P0 |
| FR-VIS-3 | `POST /api/vision/source` switches capture source (UVC/fixture/ROV) | P1 |
| FR-VIS-4 | Frame quality scoring and preprocessing before storage (`vision/quality`, `preprocess`) | P1 |
| FR-VIS-5 | `GET /api/vision/rov/status` reflects ROV link state | P1 |
| FR-VIS-6 | Frames are linked to an inspection and deduplicated by capture key | P1 |

### 6.9 Reports & Incident Evidence — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-RPT-1 | `GET /api/reports` lists generated reports | P0 |
| FR-RPT-2 | `GET /api/reports/download` streams a summary report file | P1 |
| FR-RPT-3 | `GET /api/reports/incidents` and `/incidents/:inspectionId` list/read incident reports | P0 |
| FR-RPT-4 | `GET /api/reports/incidents/:inspectionId/pdf` renders a PDF (pdfkit) with evidence frames | P0 |
| FR-RPT-5 | Web view of the report at `/incident-reports/[inspectionId]` | P0 |
| FR-RPT-6 | Reports are immutable snapshots once generated | P1 |

### 6.10 Dashboard, Analytics & System Intelligence — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-DSH-1 | `GET /api/dashboard/overview` returns active pollution count, species count, online sensors, unresolved alerts, active drones | P0 |
| FR-DSH-2 | `GET /api/analytics/trends` returns time-series trends for charts | P0 |
| FR-DSH-3 | `GET /api/system/intelligence` returns pipeline health, DB check, hardware sensor presence | P1 |
| FR-DSH-4 | Interactive ocean map with heatmap / drones / sensors layers | P0 |
| FR-DSH-5 | "Ecosystem Time Machine" projects health at 1M / 6M / 1Y / 5Y (clearly labeled as projection) | P1 |
| FR-DSH-6 | All projected/estimated values must be visually distinguished from measured values | P0 |

### 6.11 Settings & Administration — *implemented*

| ID | Requirement | Pri |
|---|---|---|
| FR-SET-1 | `GET /api/settings` returns the user's settings (falling back to platform defaults) | P0 |
| FR-SET-2 | `PATCH /api/settings` (schema-validated) updates thresholds/notification preferences | P0 |
| FR-SET-3 | `POST /api/settings/export` exports user data (GDPR-style portability) | P1 |
| FR-SET-4 | `POST /api/settings/reset` (admin) restores defaults | P1 |

### 6.12 Public & Marketing Surface — *implemented (static)*

About, Features, Innovation, Roadmap, Community, Blog, Careers, Pricing/FAQ, Help Center, Contact, Feedback, Report Issue, Accessibility, Status, Privacy/Cookie/Terms, Documentation, Team. These are presentational; they must not require auth.

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Warm-model predictions ≤ 5 ms; dashboard first meaningful paint < 2 s on broadband; SSE alert propagation P95 < 2 s |
| **Scalability** | EventBus decouples ingest from persistence; must sustain ≥ 100 readings/sec in a single-node demo; horizontal scaling of API is a V1.1 item |
| **Reliability** | Backend boots in 3 ordered steps (ML worker → species worker → sensor pipeline); each failure degrades instead of crashing |
| **Security** | Helmet headers, CORS locked to `CORS_ORIGIN`, Zod validation on every input, bcrypt password hashing, httpOnly cookies, per-IP rate limiting, device auth for IoT endpoints, no secrets in client bundles |
| **Data integrity** | SQLite in WAL mode; device provenance recorded per reading |
| **Accessibility** | WCAG 2.1 AA; axe-core CI audit (`npm run a11y:ci`) must pass |
| **Observability** | `/api/health` exposes uptime, ML readiness, SSE and EventBus stats; structured server logs |
| **Portability** | Node.js 20+, Python 3.9+; Docker Compose one-command startup |
| **Test coverage** | Jest suites covering API, SSE, pipeline, vision, drone selection, inspection, incident report, device ingest, demo flow |

## 8. System Architecture

```
Sensors / Buoys / ESP32
        │  POST /api/sensors/ingest  (device auth + Zod)
        ▼
   EventBus  ──▶  Sensor Pipeline (Consumer → Dispatcher → Inspector)
        │                 │                        │
        │                 ▼                        ▼
        │           ML Worker (RAM)         Drone Dispatch (nearest)
        │                 │                        │
        ▼                 ▼                        ▼
   SQLite (WAL) ◀── alerts / pollution_events / vision_frames / reports
        │
        ▼
   SSE Manager ──▶ Browser (Next.js dashboard, no polling)
```

**Directory map**

| Path | Responsibility |
|---|---|
| `frontend/` | Next.js 15 App Router UI, Zustand stores, Leaflet maps, Recharts |
| `backend/src/routes/` | REST + SSE endpoints (auth, sensors, drones, pollution, species, vision, reports, settings, alerts, demo, system, analytics, dashboard) |
| `backend/src/lib/` | `eventBus`, `mlWorker`, `speciesWorker`, `sensorPipeline`, `droneSelection`, `sseManager`, `deviceAuth`, `vision/*`, `incidentReport*`, `rateLimit` |
| `backend/src/db/` | SQLite schema and access layer |
| `ml/` | Python models: `anomaly_model.pkl`, `species_classifier.pt`, forecast script |
| `hardware/esp32/` | Firmware reference for the field sensor node |
| `docs/vision/` | Camera setup, validation, architecture, ROV integration |
| `hardware-validation/` | Calibration logs, sensor reference tables, phase reports |

## 9. Data Model (primary entities)

| Entity | Key fields |
|---|---|
| `users` | id, email, password_hash, role, name |
| `user_settings` | user_id, settings_json |
| `sensors` | id, name, lat, lng, online, provenance |
| `sensor_readings` | sensor_id, timestamp, pH, dissolved_oxygen, temperature, salinity, turbidity |
| `pollution_events` | id, sensor_id, severity, status, lat, lng, trajectory_json, created_at |
| `alerts` | id, severity, message, resolved, created_at |
| `drones` | id, name, status, lat, lng, battery, sector |
| `inspections` | id, drone_id, pollution_event_id, status, eta, started_at |
| `vision_frames` | id, inspection_id, source, captured_at, quality, storage_path |
| `reports` | id, inspection_id, generated_at, pdf_path |

## 10. Integrations & Interfaces

- **Device contract:** HTTP/JSON over the backend's ingest endpoints; device credentials issued by the registry. ESP32 reference implementation lives in `hardware/esp32/`.
- **ROV / camera contract:** documented in `docs/vision/rov-integration.md`; capture sources are pluggable (`uvc`, `fixture`, `rov`) behind the vision runtime.
- **Forecast model:** deterministic function of (severity, trend, horizon); not a hydrodynamic simulation — the UI must present it as a projection.
- **Exports:** PDF via pdfkit (backend), client-side PDF/zip export in the frontend for reports.

## 11. Constraints & Assumptions

- Single-node deployment for v1.0 (SQLite + in-process EventBus and SSE).
- Numeric model thresholds are tuned against synthetic/simulated data plus hardware-validation logs; real-deployment recalibration is required.
- Drivers/algorithms are benchmarked on the demo dataset, not on an audited marine dataset.
- No automated upstream weather/current feeds in v1.0.

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Model drift vs. real ocean conditions | False positives/negatives | Thresholds configurable in Settings; hardware-validation recalibration loop |
| ML worker crash | Slow/lost predictions | Auto-fallback to one-shot Python; health endpoint alerts operators |
| SSE connection storms | API starvation | SSE exempt from per-IP rate limit; stats exposed in `/api/health` |
| SQLite write contention at scale | Dropped readings | EventBus buffering + WAL; TSDB migration planned V1.1 |
| Presenting projections as measurements | Scientific credibility / user harm | FR-DSH-6 labeling requirement; confidence scores on all ML output |
| Device credential leakage | Spoofed telemetry | Device auth + revocation in registry; per-IP limits |

## 13. Release Plan

| Milestone | Scope | State |
|---|---|---|
| **M1 — Core pipeline** | Ingest → EventBus → ML worker → SSE → dashboard | ✅ Done |
| **M2 — Response loop** | Alerting, nearest-drone dispatch, inspection simulation | ✅ Done |
| **M3 — Evidence** | Vision capture, incident report HTML + PDF | ✅ Done |
| **M4 — Breadth** | Species classifier, forecasting, analytics, settings/admin | ✅ Done |
| **M4.5 — Hardening** | Rate limits, device auth, startup guards, accessibility audit | 🔄 In progress |
| **V1.1** | Time-series DB, real mock→production model retraining, password reset email, org/multi-tenant | 📋 Planned |
| **V2.0** | ROV command-and-control, hydrodynamic forecast fusion, mobile client | 📋 Planned |

## 14. Acceptance Criteria (v1.0)

1. `npm run dev:backend` and `npm run dev:frontend` start cleanly; `GET /api/health` returns `status: "ok"` with `mlWorker.ready: true`.
2. An admin can trigger the chemical-spill scenario and see a critical alert arrive over SSE in the dashboard within 2 s, without a page reload.
3. A drone is dispatched to the nearest available unit with a target sector and ETA, and the assignment appears on the map.
4. Captured inspection frames are visible via the vision endpoints, and an incident PDF is generated and downloadable.
5. Species upload returns a species name with a confidence score; low-confidence results are visibly flagged.
6. All `/api/*` endpoints validate input with Zod and return 401/403/429 appropriately; auth endpoints are limited to 5 req/min.
7. `npm --prefix backend test` passes all Jest suites; `npm --prefix frontend run a11y:ci` reports no critical accessibility violations.
8. Every page renders without console errors in dev builds.

## 15. Open Questions

1. Which real sensor hardware (beyond ESP32 reference firmware) is the first supported deployment target?
2. Is multi-tenant organizational isolation required for the first paying customer, or is single-org acceptable through V1.1?
3. Should password reset ship in M4.5 or slip to V1.1 (requires an email provider decision)?
4. What is the retention policy for raw vision frames (storage cost vs. evidentiary value)?
5. Do forecasts need confidence intervals in the UI for scientific credibility?

## 16. References

- [README.md](README.md) — quick start, features, tech stack
- [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) — narrative project guide
- [DeepSea_Project_Overview.md](DeepSea_Project_Overview.md) — end-to-end flow overview
- [docs/vision/architecture.md](docs/vision/architecture.md) — vision subsystem design
- [docs/vision/rov-integration.md](docs/vision/rov-integration.md) — ROV integration contract
- [hardware-validation/README.md](hardware-validation/README.md) — field validation protocol

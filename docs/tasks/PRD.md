# PRD — Task Definition

> **Task file** consumed by the workflow runner.
> Source of truth for the product requirements document itself: `.gsd/../PRD.md` (repo root: [`PRD.md`](../../PRD.md)).
> This file defines what "done" means for that deliverable and the follow-up work it unlocks.

---

## Objective

Produce and maintain a **Product Requirements Document** for DeepSea Guardian that describes the
platform as it is actually implemented — not the marketing description in the README. Every
requirement must be traceable to real code (a route in `backend/src/routes/`, a page in
`frontend/src/app/`, or a module in `backend/src/lib/`) so that engineering, QA, and
stakeholders share one verifiable baseline.

## Deliverable

| Item                        | Path                     | Status      |
| --------------------------- | ------------------------ | ----------- |
| PRD (primary artifact)      | [`PRD.md`](../../PRD.md) | ✅ Complete |
| Task definition (this file) | `docs/tasks/PRD.md`      | ✅ Complete |

## Acceptance Criteria

- [x] `PRD.md` exists at repo root.
- [x] Contains: overview, problem statement, goals with measurable metrics, non-goals.
- [x] Contains: personas and end-to-end user journeys.
- [x] Contains: functional requirements with IDs (`FR-*`) and P0/P1/P2 priorities, covering all 14 backend route modules.
- [x] Contains: non-functional requirements (performance, security, accessibility, reliability).
- [x] Contains: architecture diagram, directory map, and data model.
- [x] Contains: constraints, risk register with mitigations, release plan, acceptance criteria, open questions.
- [x] Every requirement domain states its implementation status (`implemented` / planned).
- [x] Gaps found during analysis are recorded explicitly rather than implied as complete:
  - Password-reset email delivery is not wired (UI only).
  - Forecasts and "Ecosystem Time Machine" are projections, not hydrodynamic simulations — labeling required.

## Requirements

### REQ-01 — Product Overview & Problem Statement

Describe the three cooperating layers (Next.js frontend, Express backend, Python ML engine) and the
problem (unmonitored ocean, delayed spill detection, costly manual inspection).

### REQ-02 — Goals & Success Metrics

Numeric targets: alert latency P95 < 2 s, warm-model inference 1–5 ms, ingest success ≥ 99.5 %,
WCAG 2.1 AA, 99.5 % monthly availability. Plus explicit non-goals for v1.0.

### REQ-03 — Personas & User Journeys

Six personas (operator, scientist, response coordinator, admin, field device, public visitor) and
five journeys: spill response, forecasting, species ID, ROV inspection, device onboarding.

### REQ-04 — Functional Requirements

Twelve domains with stable IDs and priorities, each tagged with implementation status:

| Domain                      | Prefix             | Backend source                                                   |
| --------------------------- | ------------------ | ---------------------------------------------------------------- |
| Authentication & Users      | `FR-AUTH`          | `routes/auth.ts`, `lib/authMiddleware.ts`                        |
| Sensor Ingestion & Pipeline | `FR-ING`           | `routes/sensors.ts`, `lib/eventBus.ts`, `lib/sensorPipeline.ts`  |
| Live Streaming (SSE)        | `FR-SSE`           | `routes/sensors.ts`, `lib/sseManager.ts`                         |
| ML Anomaly & Forecasting    | `FR-ML`            | `routes/pollution.ts`, `lib/mlWorker.ts`, `routes/demo.ts`       |
| Pollution & Alerts          | `FR-POL`, `FR-ALT` | `routes/pollution.ts`, `routes/alerts.ts`                        |
| Drone Fleet                 | `FR-DRN`           | `routes/drones.ts`, `lib/droneSelection.ts`                      |
| Species Classification      | `FR-SPC`           | `routes/species.ts`, `lib/speciesWorker.ts`                      |
| Vision / ROV                | `FR-VIS`           | `routes/vision.ts`, `lib/vision/*`                               |
| Reports & Evidence          | `FR-RPT`           | `routes/reports.ts`, `lib/incidentReport*.ts`                    |
| Dashboard & Analytics       | `FR-DSH`           | `routes/dashboard.ts`, `routes/analytics.ts`, `routes/system.ts` |
| Settings & Admin            | `FR-SET`           | `routes/settings.ts`                                             |
| Public Surface              | —                  | `frontend/src/app/*` (static marketing pages)                    |

### REQ-05 — Non-Functional Requirements

Performance, scalability, reliability, security, data integrity, accessibility, observability,
portability, and test coverage — each with a concrete, checkable statement.

### REQ-06 — Architecture, Data Model & Integrations

ASCII pipeline diagram, directory responsibility map, primary entities, device and ROV contracts.

### REQ-07 — Risks, Release Plan, Open Questions

Risk/impact/mitigation table, milestone table with honest status (M1–M4 done, M4.5 in progress),
and five open questions requiring stakeholder input.

## Tasks

<task type="auto">
  <name>Inventory implemented surface</name>
  <files>
    backend/src/server.ts
    backend/src/routes/*.ts
    frontend/src/app/**/page.tsx
    backend/package.json
    frontend/package.json
  </files>
  <action>
    Extract route mounts, rate limits, middleware order, boot sequence, and page inventory.
    AVOID relying on README.md feature claims as requirements — verify each against a route or page.
  </action>
  <verify>Every `FR-*` row in PRD.md maps to a file listed above.</verify>
  <done>No requirement describes functionality that has no corresponding route, page, or lib module.</done>
</task>

<task type="auto">
  <name>Write PRD sections</name>
  <files>PRD.md</files>
  <action>
    Fill all 16 numbered sections per the acceptance criteria above.
    State implementation status per domain; record known gaps in §13 and §15.
  </action>
  <verify>Repo-root PRD.md contains sections 1–16 and every FR domain has a priority column.</verify>
  <done>Document is self-contained; a new engineer can implement against it without reading source.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Stakeholder review of open questions</name>
  <files>PRD.md</files>
  <action>
    Resolve §15 open questions: first supported sensor hardware beyond ESP32 reference firmware,
    multi-tenant requirement timing, password-reset scope (M4.5 vs V1.1), vision-frame retention
    policy, and whether forecasts need confidence intervals.
  </action>
  <verify>Maintainer reviews PRD.md §15 and either answers or defers each question.</verify>
  <done>Each open question has an owner and a decision or a target milestone.</done>
</task>

<task type="auto">
  <name>Reconcile known gaps with roadmap</name>
  <files>
    PRD.md
    backend/package.json
  </files>
  <action>
    Two known gaps are recorded in the PRD but not yet scheduled:
    1. `backend/package.json` contains unresolved merge-conflict markers around the
       `typescript` version — resolve before the next install.
    2. Password-reset email delivery is missing (UI exists at `frontend/src/app/forgot-password`).
    Add each to the release plan with an owner once decided.
  </action>
  <verify>npm --prefix backend install --dry-run completes without conflict-marker errors.</verify>
  <done>Both gaps appear in PRD.md §13 with an assigned milestone.</done>
</task>

## Must-Haves

- [x] The PRD is grounded in code, not in the README's marketing copy.
- [x] Requirements are prioritized (P0/P1/P2) and stable-ID'd for traceability.
- [x] Known gaps are stated plainly, with a requirement forcing projections to be labeled as projections.
- [ ] Open questions reviewed by a maintainer.
- [ ] Gaps reconciled into the release plan.

## Success Criteria

- [x] All `auto` tasks verified passing.
- [x] Must-haves confirmed (excluding the two stakeholder-dependent items).
- [ ] No regressions introduced — no source files were modified to produce this document.

---

## Traceability

| Requirement | Source               | Verification                                 | Status   |
| ----------- | -------------------- | -------------------------------------------- | -------- |
| REQ-01      | Problem statement    | PRD §1–2                                     | Complete |
| REQ-02      | Success metrics      | PRD §3                                       | Complete |
| REQ-03      | User journeys        | PRD §4–5                                     | Complete |
| REQ-04      | Route/page inventory | `backend/src/routes/*`, `frontend/src/app/*` | Complete |
| REQ-05      | NFR table            | PRD §7                                       | Complete |
| REQ-06      | Architecture         | PRD §8–10                                    | Complete |
| REQ-07      | Risk & release       | PRD §12–13, §15                              | Complete |

## Status Definitions

| Status      | Meaning                  |
| ----------- | ------------------------ |
| Pending     | Not yet started          |
| In Progress | Being implemented        |
| Complete    | Implemented and verified |
| Blocked     | Cannot proceed           |
| Deferred    | Moved to later milestone |

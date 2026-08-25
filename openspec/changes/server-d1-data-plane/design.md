# server-d1-data-plane — design

## Context

The pure diff layer (`schema-diff.ts`) is already backend-agnostic — it consumes/produces plain shapes. Only the I/O around it is pg-bound. This change adds a second I/O implementation for the schema slice, behind the `SpaceD1Executor` seam `server-d1-backend` shipped.

## Decisions

### D1 — Raw SQL over the executor, not a drizzle sqlite driver
Production D1 access is the HTTP query API (per-Space databases can't be bindings), so the module speaks parameterized SQL strings against `SpaceD1Executor`. Tests run the SAME statements on `node:sqlite` — the semantics D1 implements. No drizzle-sqlite dependency in the Worker bundle.

### D2 — Tests on real SQLite with the real DDL
The test fixture applies `SPACE_SQLITE_DDL` (the bundled provisioner DDL) to an in-memory database and runs the module against it. This is stronger than mocks in two ways: statement semantics are real, and every test run re-proves the bundled DDL applies cleanly — the thing token-day depends on.

### D3 — No cross-statement transaction; idempotent-upsert convergence
The D1 HTTP API executes statement-by-statement. Instead of pretending atomicity, every write is an upsert keyed on natural ids (base_id/table_id/field_id/view_id, base+hash, backup_run+base), so a partially-applied sync converges on the next run. This mirrors how the run-row state machine already treats transport failures. Accepted entry-tier trade-off; promotion to managed_pg is the answer if it ever matters.

### D4 — Skips are explicit, never silent
d1 schema-sync skips MCP views/interfaces/automations, inference, AI, and the lazy upgrade. Each optional section that the request actually carried reports `{ ok:false, reason:"d1_unsupported" }` so the workflows task's run progress shows the truth. The upgrade skip is safe by construction: provision-d1 stamps the current `SPACE_SCHEMA_VERSION`, and there are no older d1 Spaces (the backend was never live before this).

### D5 — Scoped schema-read stays 501
Browse's initial tree uses the unscoped read; the scoped variant (per-entity panels) keeps `backend_not_implemented` with reason `d1_scoped_unsupported` until a real need appears. Half-lit surfaces are labeled, not faked.

## Risks

- **[Latency]** One HTTP round-trip per statement on the sync write path. A typical base sync is tens of statements — acceptable at entry tier; batching via `/query`'s multi-statement body is the first optimization if needed.
- **[Drift between twins]** `space-db-d1.ts` mirrors pg semantics by hand. Mitigation: shape-parity assertions in tests reuse the pg module's exported types (`PriorWorkingSet`, `LifecycleOp`), so a shape change breaks the d1 build/tests immediately.

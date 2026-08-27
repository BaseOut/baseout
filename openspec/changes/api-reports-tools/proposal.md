# api-reports-tools

## Why

Reports is the most MCP-ready area in the app-parity plan (`plans/2026-08-27-mcp-app-parity.md`
Phase 1): full CRUD + run + export + history + resend already exist behind authenticated HTTP —
web proxies (`apps/web/src/pages/api/spaces/[spaceId]/reports*`) over server internal brokers
(`apps/server/src/pages/api/internal/spaces/report*`) over `apps/server/src/lib/reports/store.ts`,
with the render leg on Trigger.dev. Dan's ask "create/edit/ask the reports" needs no backend
build — only an `apps/api` operations layer + MCP tools forwarding to the internal brokers via
the existing `server-client.ts` pattern.

One boundary must move in the same change: the `active_reports` entitlement cap is enforced only
in the WEB proxy today (`checkCreationCap` + `resolveEntitlements` in `reports.ts` POST). An API
write path calling the broker directly would bypass billing limits — plan decision D2 pushes
enforcement down to the server broker as the single choke point.

## What Changes

- **New `apps/api/src/operations/reports.ts`** (scopes `reports:read` / `reports:write` — note:
  reports reads today ride no scope because no reports operations exist; reads get
  `reports:read`, distinct from `backups:read`):
  list/get/create/update/delete definitions · run-now (optional ad-hoc window) · get run
  (rendered document + status) · list runs for a definition · resend failed deliveries ·
  artifact retrieval (see design D3 — bytes vs URL).
- **~10 MCP tools** mirroring those operations 1:1 (`list_reports`, `get_report`,
  `create_report`, `update_report`, `delete_report`, `run_report`, `get_report_run`,
  `list_report_runs`, `resend_report_deliveries`, `get_report_artifact`), grant-aware like the
  existing 18 (spaceId elision, orgId injection).
- **`apps/server` broker gains the cap check** (paired single-app follow-up per §3.6:
  `server-reports-cap` if reviewers prefer it split; small enough to ride along —
  design D2 argues inline): `report.ts`/`reports.ts` POST enforces `active_reports` from
  `resolveEntitlements`; web proxy keeps its check as pre-flight UX.
- Deleting the default report stays 403; report RUNS remain undeletable (matches UI).

## Capabilities

### New Capabilities
- `api-reports`: report definitions and runs are fully operable from the public API and MCP
  under scoped tokens — the first write surface, and the app-parity demo milestone ("an MCP
  client can create and run a report").

### Modified Capabilities
- Entitlement enforcement for report creation moves to the server broker (web behavior
  unchanged from the user's seat; the boundary just stops being bypassable).

## Impact

- `apps/api` (operations, tools, tests) + one enforcement addition in `apps/server`'s report
  brokers. Web untouched at runtime.
- Depends on: `api-write-foundation` (write plumbing, scopes, dispatch hardening).
- Security (§3.3): mutations behind `reports:write` opt-in; recipients validation reuses the
  broker's `validateRecipients` (external emails are a data-egress surface — unchanged rules,
  now reachable by token; called out for review); artifact access tenant-guarded same-404.
- Excluded per Dan: nothing here touches backup runs/config.

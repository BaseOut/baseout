# Design — api-reports-tools

## D1 — apps/api talks to the BROKER, not the web proxy

Same lane as schema reads: `server-client.ts` grows `report*` fetchers against
`/api/internal/spaces/report*` with `x-internal-token`. The web proxies exist for browser
sessions (better-auth + IDOR guards); apps/api authenticates by token and enforces tenancy
itself (guards.ts confirms the space belongs to the grant's org before any broker call —
same-404 posture). Payload shapes: reuse the broker contracts verbatim; the operation layer's
Zod schemas describe them (single source: extract the definition-payload schema into a small
shared module in apps/server consumed type-only by apps/api? NO — cross-app type imports stay
type-only per repo rule; apps/api declares its own Zod mirroring the broker contract, and the
contract test in task 4.2 pins the agreement).

## D2 — Cap enforcement rides along, in the broker

The check is ~15 lines in the broker POST path (resolveEntitlements + countActiveReportsForOrg
already live in reach of apps/server — verify import path; if entitlement resolution is
web-owned code, mirror the minimal resolver the same way backup_runs mirrors master tables,
header-commented to the canonical source). Refusal shape: 403 `report_cap_reached` with the
cap + current count, so both web UX and MCP callers can render "upgrade" copy. Web's pre-flight
check stays (nicer error placement in the form). If reviewers judge the mirror too heavy, this
task splits out as `server-reports-cap` and this change gates on it — flagged at review, not
silently decided.

## D3 — Artifacts: URL out, not bytes out

MCP results are text/JSON; streaming a PDF through a tool call is hostile to every client.
`get_report_artifact` returns `{format, expiresAt?, url}` where url is a short-lived signed
web route the existing artifact streamer already implements per-session… which token callers
lack. Resolution: the operation mints a one-time capability URL on the API worker itself
(`GET /v1/.../artifact-download?sig=…`, HMAC over runId+format+expiry with INTERNAL_TOKEN-derived
key, 10-minute TTL) that streams from the broker on redemption. No new secret; no session
required; tenant checked at mint time. REST callers may also just GET the operation with
`Accept: application/pdf` for direct bytes (REST can stream; only MCP needs the URL shape).

## D4 — "Ask the reports" = reads that answer questions

`get_report_run` returns the rendered run DOCUMENT JSON (sections, KPIs, per-base outcomes) —
that is the asking surface; no bespoke query language. `list_report_runs` carries status +
window filters mirroring the broker's list. Cross-definition run listing (the survey's noted
gap) is NOT built — nesting under the definition matches the app and nobody has asked.

## D5 — Tool descriptions are product copy

The catalog's descriptions must use canonical naming (Features §1) and say the cap/refusal
behavior out loud ("fails with report_cap_reached when the plan's active-report limit is
reached") — agents behave better when told the rules. Reviewed against §1 in task 4.3.

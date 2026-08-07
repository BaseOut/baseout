# Section A — coordinated build plan (2026-08-07)

**Purpose.** "Section A" (the buildable-now, no-decision-needed pricing/tiers/entitlements +
storage/DB structural work) spans **four** OpenSpec changes. Per CLAUDE.md §3.6 an OpenSpec
change is single-scoped, so these cannot be merged into one change — they touch different
subsystems and revert independently. This doc is the **single coordinating index** across them:
the specs stay in their own `openspec/changes/<name>/` dirs; this table is the one-page view of
what's in scope today, the order, and cross-change ordering. Update the Status column as tasks land.

## The four changes + today's in-scope tasks

| Change | In-scope tasks (today) | Status | Commit |
|---|---|---|---|
| `system-r2-bucket-topology` | 1.1 `resolveManagedBucketName`; 2.1 `buildR2Key` kind-branch | ✅ done | `4a4a1c7` |
| `shared-db-isolation-ladder` | L2.1 pure gate; L1 `isolation_class`/`cluster_id`/`db_clusters` (migration) | ✅ done | `c3452a6` (L2.1), `6e88b4d` (L1) |
| `shared-entitlements` | destinations creation-cap (4.3) | ✅ done | `2f218f6` |
| `shared-entitlements` | retention wiring (4.4) | ⛔ deferred | — (live deletion logic, no dark-launch flag) |
| `shared-ai-byok` | 1.1 migration; 2.1/2.2 key-management API; 3.1 engine deps (mirror + findActiveKey + isByokEntitled) | ✅ done | `1a1325c`, `cbe89ce`, `76a7974` |
| `shared-ai-byok` | 3.3 credential endpoint + 4.2/4.3 call-site routing | ⛔ deferred | — routing needs per-provider clients (anthropic/openai) in the two Workers-AI adapters — larger than a seam wire |
| `system-r2-bucket-topology` | caller wiring (managed backups → per-account bucket) | ⛔ blocked | R2 provisioning creds live only in the Trigger.dev env; can't verify locally (verify-then-code) |

Also shipped earlier this cycle: entitlements creation-cap kernel + usage endpoint (9.1) + Spaces & Seats
enforcement (`d73a9bf`, `7d52bd5`). Every enforcement path is behind `ENTITLEMENT_ENFORCEMENT` (default off).

Already shipped this cycle (do not rebuild): entitlements creation-cap kernel + usage endpoint
(9.1 org-scope) + Spaces & Seats cap enforcement (`shared-entitlements` 3.4 / 4.3 subset / 9.1).
`system-per-space-db` §1.3/§2.2 lazy migration runner is DONE via `system-per-space-upgrade`.

## Cross-change ordering
- DB-iso L2.1 (pure gate) has no deps → build first; L1 (migration) before any provisioning wire.
- ai-byok 1.1 migration gates the API (2.x); `resolveAiRouting` wiring (4.2/4.3) needs a server-side
  read-only `ai_provider_keys` mirror (3.1).
- entitlements 4.4 (retention) reads `resolveEntitlements` (built) → unblocked; feeds the per-Space
  `record-updates-prune.ts` mechanism (built) which currently has no caller.
- r2 §4.3 body-bytes metering (deferred) feeds entitlements §3.2a; isolation-ladder L5.1 must reconcile
  with the already-shipped entitlements §3.2 DB-size measurer (don't build fresh).

## Deferred / flagged (with reasons)
- `shared-entitlements` 2.3 server cutover — behavior-changing across 5 engine call sites; needs a
  server `preferEntitlements` flag + parity. Do last/carefully.
- `shared-entitlements` 5.1 real limit emails — apps/server has **no** `send_email` binding (rail is
  apps/web only); needs a forward-to-web internal route or a new server binding.
- `shared-entitlements` 4.4 retention wiring — modifies **live data-deletion logic** (the retention
  cron) and has **no** dark-launch flag, so a change flips deletion windows immediately on deploy.
  Deserves a careful standalone pass: read `decide-deletions.ts`, add a guard/flag, and reconcile the
  new per-tier windows (Lite 90d … Max 1095d) against the legacy `TIER_CAP_DAYS` ladder before cutover.
- `shared-ai-byok` 2.3 settings UI (ui-sync/Storybook governed), 4.1 chat task (workflows Anthropic
  path), 3.3 credential-fetch endpoint (pair with 4.1).
- `system-r2-bucket-topology` §4 doc-body relocation; `shared-db-isolation-ladder` L3+ — the
  non-additive / provisioning-heavy items, explicitly not "buildable-now."

Everything above is behind `ENTITLEMENT_ENFORCEMENT` (default off) where it enforces — safe to land dark.

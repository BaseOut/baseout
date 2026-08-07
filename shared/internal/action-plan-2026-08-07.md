# Section A — coordinated build plan (2026-08-07)

**Purpose.** "Section A" (the buildable-now, no-decision-needed pricing/tiers/entitlements +
storage/DB structural work) spans **four** OpenSpec changes. Per CLAUDE.md §3.6 an OpenSpec
change is single-scoped, so these cannot be merged into one change — they touch different
subsystems and revert independently. This doc is the **single coordinating index** across them:
the specs stay in their own `openspec/changes/<name>/` dirs; this table is the one-page view of
what's in scope today, the order, and cross-change ordering. Update the Status column as tasks land.

## The four changes + today's in-scope tasks

| Change | In-scope tasks (today) | Status | Notes |
|---|---|---|---|
| `system-r2-bucket-topology` | 1.1 `resolveManagedBucketName`; 2.1 `buildR2Key` kind-branch | ⏳ in progress | pure kernels; `kind` optional (default `byos`) so existing callers are unchanged. §4 doc-body relocation stays LAST (non-additive). |
| `shared-db-isolation-ladder` | L2.1 pure gate; L1 `isolation_class`/`cluster_id`/`db_clusters` (migration) | ⏳ in progress | `database_isolation_class` slug + ladder already seeded/resolvable. L3+ (cluster provisioning, promotion job) deferred. |
| `shared-entitlements` | destinations creation-cap (4.3); retention wiring (4.4) | ⬜ pending | destinations = 4 BYOS callback insertion points, per-org distinct-external count. 2.3 (server cutover) + 5.1 (emails) flagged below. |
| `shared-ai-byok` | 1.1 migration; 4.2/4.3 route Workers-AI sites + 3.1 mirror; 2.1/2.2 API | ⬜ pending | `persistProviderKey` (1.2) + `resolveAiRouting` (3.2) already built. 2.3 UI + 4.1 chat + 3.3 endpoint deferred. |

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
- `shared-ai-byok` 2.3 settings UI (ui-sync/Storybook governed), 4.1 chat task (workflows Anthropic
  path), 3.3 credential-fetch endpoint (pair with 4.1).
- `system-r2-bucket-topology` §4 doc-body relocation; `shared-db-isolation-ladder` L3+ — the
  non-additive / provisioning-heavy items, explicitly not "buildable-now."

Everything above is behind `ENTITLEMENT_ENFORCEMENT` (default off) where it enforces — safe to land dark.

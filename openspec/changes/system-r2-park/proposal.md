> **Supersedes**: [`system-r2-stance`](../archive/2026-05-18-system-r2-stance/proposal.md) — That change recorded "managed R2 stays as the all-tiers default." This change reverses that decision: managed R2 is **paused** (not deleted) until further notice. Downstream proposals that referenced `system-r2-stance` re-point at this change.

## Why

On 2026-05-18 [`system-r2-stance`](../archive/2026-05-18-system-r2-stance/proposal.md) decided: managed Cloudflare R2 stays as the all-tiers default destination behind a `StorageWriter` abstraction. On 2026-05-19 commit [`fbdc26e`](../../../apps/server/wrangler.jsonc.example) (chore(openspec): file web-ai-verify + web-rescan-e2e scaffolding — note: commit message refers to the openspec churn, but the same commit also restored the `BACKUPS_R2` binding to `apps/server/wrangler.jsonc.example`, `wrangler.test.jsonc`, and `apps/server/src/env.d.ts`) executed Phase 0 of [`server-byos-destinations`](../server-byos-destinations/proposal.md) and put the R2 binding back. **After that** commit landed, the boss verbally vetoed paying for managed R2.

This is the second decision-of-record reversal in 48 hours. Without a written decision, the next contributor will find:
- A `BACKUPS_R2` binding in `wrangler.jsonc.example` (suggesting R2 is wired up).
- A `r2-managed.ts` strategy under `apps/server/src/lib/storage/strategies/` (suggesting R2 is the default).
- A `storageType: 'r2_managed'` default on `backup_configurations` in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) (suggesting new backups default to managed R2).
- An MVP allowlist of `["r2_managed"]` in [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts) (suggesting BYOS is the *future* path).
- An archived `system-r2-stance` decision that says all of the above is correct.

The actual state-of-play is: Google Drive shipped today in [`cea7f08`](../../../apps/web/src/lib/google-drive/oauth.ts) as the first connectable BYOS destination; managed R2 is **off the table** as a paid line item. The drift between code, openspec, and verbal direction needs a written reversal so no one re-introduces R2 work by accident.

The memory entry that currently captures this state — [`project_r2_informal_veto.md`](file:///Users/autumnshakespeare/.claude/projects/-Users-autumnshakespeare-baseout/memory/project_r2_informal_veto.md) — is intentionally labelled "informal." This change is the documented version.

## What Changes

**Decision: managed Cloudflare R2 is paused — not deleted — until further notice. BYOS destinations are the only writeable storage path in V1.**

This is a *temporary pause*, not a permanent BYOS-only pivot. R2 may return; the cheapest path to revival is the deciding factor in every choice below.

### Concrete consequences

1. **Code is removed, not gated.** The `BACKUPS_R2` binding, the `STORAGE_DEV_MODE` env var, `r2-managed.ts`, and the R2 strategy integration test all go. Reviving is a `git restore` away — the shapes are recoverable from `git show fbdc26e^..` and `git show 52c1315`. Keeping dead code behind a feature flag is more confusing than deleting it.

2. **Schema leaves the door open.** The `storage_destinations.type` CHECK constraint (per [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase A) keeps `r2_managed` as a permitted value. Reviving managed R2 then becomes a single app-layer flag, not a migration. Only the `backup_configurations.storageType` DEFAULT `'r2_managed'` is dropped (so new backup configs don't auto-pick an unwriteable destination).

3. **Three downstream proposals park their R2 work in Out of Scope.** `server-byos-destinations` Phase 0, `server-attachments` Phase B's "pipe to R2," and `server-retention-and-cleanup`'s R2 `DELETE` path each move from active to deferred. The `StorageWriter` interface (Phase B of `server-byos-destinations`) stays — every BYOS provider implements it — so deferring R2 does not block Drive/Dropbox/Box/OneDrive/S3/Frame.io.

4. **PRD and Features get a one-row touch-up, not a rewrite.** The R2 row in [PRD §7.2](../../../shared/Baseout_PRD.md) destinations table becomes `Cloudflare R2 (Baseout-managed) — V2 (paused per system-r2-park)`. [Features §6.6](../../../shared/Baseout_Features.md) matches. The encryption claim in [PRD §20.2](../../../shared/Baseout_PRD.md) shifts to "BYOS-provider TLS + encryption-at-rest; managed-R2 path paused." Nothing else moves.

5. **`local-fs-write.ts` stays as the dev path.** Backup runs continue to write to `apps/server/.backups/` on the dev machine via [`apps/workflows/trigger/tasks/_lib/local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts). Unchanged.

### What this change does NOT do

- It does not remove the `r2_managed` enum value from the CHECK constraint or migrate the column.
- It does not rewrite the PRD to make BYOS mandatory across all sections.
- It does not delete the `StorageWriter` interface — every BYOS provider needs it.
- It does not touch `buildR2Key` in [`apps/workflows/trigger/tasks/_lib/r2-path.ts`](../../../apps/workflows/trigger/tasks/_lib/r2-path.ts) — despite the name, it is a generic path-builder consumed by `local-fs-write.ts`.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change — R2 revival | Re-add `BACKUPS_R2` binding to `wrangler.jsonc.example`, `wrangler.test.jsonc`, `env.d.ts`. |
| Future change — R2 revival | Re-add `r2-managed.ts` strategy + integration test under `apps/server/src/lib/storage/strategies/`. |
| Future change — R2 revival | `server-attachments` Phase B "pipe to R2" path. |
| Future change — R2 revival | `server-retention-and-cleanup` R2 `DELETE` path. |
| Future change — R2 revival | Restore `STORAGE_DEV_MODE` env var (used to select R2 vs local-fs in dev). |
| Future change — schema cleanup | Drop the `r2_managed` value from the `storage_destinations.type` CHECK constraint. **Intentionally not done here** — leaving the value reduces revival cost to a single app-layer flag. |
| Future change — PRD pivot | Rewrite [PRD §7.2](../../../shared/Baseout_PRD.md) to make BYOS the architectural mandate. This pause does not promote BYOS to "the" architecture; it only parks R2. |

## Capabilities

### New capabilities

None. This is a decision-of-record + a coordinated set of edits across openspec proposals, the code, the master DB schema default, and the product specs.

### Modified capabilities

None directly. The capabilities defined in [`server-byos-destinations`](../server-byos-destinations/proposal.md) (`backup-storage-writer-interface`, `backup-storage-destination-persistence`, `backup-storage-oauth-connect`) remain — this change only reorders which strategy ships first (Google Drive replaces `r2-managed.ts`).

## Impact

- **Master DB**: a single ALTER on [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — `backup_configurations.storageType` loses its `'r2_managed'` DEFAULT. Generated migration `apps/web/drizzle/0012_pause_r2_default.sql`. The `storage_destinations.type` CHECK constraint is **not** touched.
- **Secrets**: any R2 credentials currently provisioned (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, bucket token) can be revoked at Cloudflare. No new secrets.
- **Cross-app contract**: the `INTERNAL_TOKEN`-gated engine endpoints between `apps/web` and `apps/server` are unchanged. The wire format is unchanged.
- **Code blast radius**:
  - Delete: `apps/server/src/lib/storage/strategies/r2-managed.ts`, `apps/server/tests/integration/storage/r2-managed.test.ts`.
  - Edit: `apps/server/src/env.d.ts`, `apps/server/wrangler.jsonc.example`, `apps/server/wrangler.test.jsonc`, `apps/server/CLAUDE.md`, `apps/server/src/lib/storage/storage-writer.ts`, `apps/server/src/lib/runs/start.ts`, plus integration-test fixtures.
  - Edit: `apps/web/src/lib/backup-config/persist-policy.ts`, `apps/web/src/lib/integrations.ts`, `apps/web/src/stores/connections.ts`, `apps/web/src/components/backups/StoragePicker.astro`, `apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts`, `apps/web/src/db/schema/core.ts`, plus integration + e2e fixtures.
  - New: `apps/web/drizzle/0012_pause_r2_default.sql` + regenerated drizzle snapshot.
- **Trigger.dev workflows**: untouched. `apps/workflows/trigger/tasks/_lib/local-fs-write.ts` and `r2-path.ts` stay as-is (the latter is misnamed but provider-agnostic).
- **User-facing UX**: the `StoragePicker` no longer offers managed R2 as a default-selectable option; Google Drive becomes the recommended destination. Customers in the trial flow must connect a BYOS destination before their first backup runs — a change from the trial-spec assumption in `system-r2-stance` design.md §"Why not BYOS-only," which is hereby superseded.

## Reversibility

High — this is precisely why the pause is structured as "delete code, keep enum, drop default."

To revive managed R2:
1. `git revert` the code-deletion commit (or `git show <hash> -- <path>` and re-add).
2. Re-introduce the `'r2_managed'` DEFAULT on `backup_configurations.storageType` with a new migration.
3. Promote `r2_managed` back into the MVP allowlist in `persist-policy.ts`.
4. Archive this change as superseded by a `system-r2-revive` proposal.

The `storage_destinations.type` CHECK constraint already permits `r2_managed`, so no schema migration is required on revival. Existing customer rows with `storageType='r2_managed'` (if any) are unaffected — only the default for *new* rows changes.

If the boss reverses the veto next week, the revival path is a one-day job, not a week of refactoring.

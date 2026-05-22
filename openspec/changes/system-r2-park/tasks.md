## Phase 1 — Park R2 in three downstream openspec proposals

Each downstream proposal currently has a `> Depends on: system-r2-stance` header (or equivalent reference). Strike that line, replace with a `> Depends on: system-r2-park` reference, and move R2-specific Phase work into the **Out of Scope** table with `Future change — R2 revival`.

### 1.1 — `server-byos-destinations`

- [x] 1.1.1 Edit [openspec/changes/server-byos-destinations/proposal.md](../server-byos-destinations/proposal.md) line 1 — replace `> Depends on: system-r2-stance` with `> Depends on: system-r2-park` and update the trailing prose so it no longer describes Phase 0 as "re-introduces the BACKUPS_R2 binding."
- [x] 1.1.2 Move Phase 0 (lines 29–37 of `proposal.md`) out of "What Changes" and into the Out of Scope table as `Future change — R2 revival | Re-introduce managed R2 binding + r2-managed.ts strategy (was Phase 0 pre-system-r2-park).`
- [x] 1.1.3 In Phase B strategy list (line 74 of `proposal.md`), drop the `r2-managed.ts` bullet entirely.
- [x] 1.1.4 In the Phase B `makeStorageWriter` example (lines 82–89), rewrite so the inline example uses `google_drive` instead of an implied R2 default. Strategy selection comment should describe loading a connected destination row (no fallback to managed R2).
- [x] 1.1.5 Edit [openspec/changes/server-byos-destinations/tasks.md](../server-byos-destinations/tasks.md) — strike the entire `## Phase 0` block (binding restoration → env typing → STORAGE_DEV_MODE → r2-managed strategy → r2-managed test). Renumber following phases only if downstream task references break; otherwise leave the gap and add a one-line note: `Phase 0 parked per system-r2-park.`
- [x] 1.1.6 Edit [openspec/changes/server-byos-destinations/design.md](../server-byos-destinations/design.md) — remove the Phase 0 design subsection added under `system-r2-stance` (binding shape + R2 strategy class). Add a one-paragraph note at the top: `Per system-r2-park, the Phase 0 managed-R2 work is parked. Phase A (schema) and Phase B (StorageWriter + BYOS strategies) remain in scope.`

### 1.2 — `server-attachments`

- [x] 1.2.1 Edit [openspec/changes/server-attachments/proposal.md](../server-attachments/proposal.md) line 1 — replace the `Depends on: system-r2-stance` header with `Depends on: system-r2-park`. Update the trailing sentence so "Phase B's R2-writing path requires…" becomes "Phase B's writing path is parked pending R2 revival; the dedup table (Phase A) is independent and proceeds."
- [x] 1.2.2 In `proposal.md` Phase B, swap `r2_object_key` references on `attachment_dedup` for a provider-agnostic name (`destination_key` or `storage_key`) — **spec only**, no schema migration (the column isn't added yet).
- [x] 1.2.3 Move Phase B "pipe to R2" bullet into Out of Scope as `Future change — R2 revival | Phase B per-base attachment-write to managed R2.`
- [x] 1.2.4 Edit [openspec/changes/server-attachments/tasks.md](../server-attachments/tasks.md) — replace the existing "blocked on byos-destinations Phase 0" banner with "blocked pending R2 revival per system-r2-park." Phase A (dedup schema, helper, frontend dedup-lookup endpoint) is unblocked.

### 1.3 — `server-retention-and-cleanup`

- [x] 1.3.1 Edit [openspec/changes/server-retention-and-cleanup/proposal.md](../server-retention-and-cleanup/proposal.md) line 1 — replace `Depends on: system-r2-stance` with `Depends on: system-r2-park` and update the trailing sentence: "The cleanup engine's DELETE path is parked pending R2 revival; the retention-policy schema (Phase A) remains in scope. `writer.delete()` stays in the StorageWriter interface and is implemented by every BYOS strategy."
- [x] 1.3.2 Move R2-specific `DELETE` work into Out of Scope as `Future change — R2 revival | Managed-R2 DELETE path for snapshot cleanup.`
- [x] 1.3.3 Edit [openspec/changes/server-retention-and-cleanup/tasks.md](../server-retention-and-cleanup/tasks.md) — replace the per-task `[blocked on byos-destinations Phase 0]` markers (C.2.1–C.2.3, C.5.1–C.5.2, D.1.1–D.1.2 per the prior `system-r2-stance` tasks.md) with `[blocked pending R2 revival per system-r2-park]`. BYOS-provider cleanup paths are unblocked. _Implemented: the markers were not just demoted to "pending R2 revival" — they were removed entirely, because the cleanup engine no longer issues destination-side `DELETE` requests at all. The work is unblocked. Tests now assert NO `StorageWriter.delete()` invocation. The follow-up `[ ] OUT-2 / OUT-3` rows were re-worded to reference a future `server-r2-revive` change instead of treating R2 lifecycle as imminent._
- [x] 1.3.4 Edit [openspec/changes/server-retention-and-cleanup/design.md](../server-retention-and-cleanup/design.md) — out-of-band addition during Phase 1 to keep design + proposal in sync. Added top-of-file `Per system-r2-park…` note; flipped the cron-task `makeWriter` injection to a no-op comment; rewrote "R2 delete safety" → "Safety (metadata-only path)"; renamed `decideDeletions` return semantics from "delete" to "expire" in the prose without changing the function signature; replaced `deletedObjectCount` with `expiredRunIds` in the engine route's return shape; flipped the testing-strategy table from "Miniflare R2 seeded" to "Postgres-only, mock the writer with zero invocations expected."

## Phase 2 — Backend code rollback (`apps/server`)

Land as one commit: `revert(server): pause managed R2 per system-r2-park`. Surface the smoke command from the verification block to the user before committing per the local-only-commits workflow.

### 2.1 — Delete

- [x] 2.1.1 Delete `apps/server/src/lib/storage/strategies/r2-managed.ts` (added in commit `52c1315`).
- [x] 2.1.2 Delete `apps/server/tests/integration/storage/r2-managed.test.ts` (added in commit `52c1315`).

### 2.2 — Edit `wrangler` + env

- [x] 2.2.1 Edit `apps/server/src/env.d.ts` — remove `BACKUPS_R2: R2Bucket` and `STORAGE_DEV_MODE` fields (added in `fbdc26e` around lines 31–45).
- [x] 2.2.2 Edit `apps/server/wrangler.jsonc.example` — delete the top-level `r2_buckets` block AND the `env.dev.r2_buckets` block (added in `fbdc26e`).
- [x] 2.2.3 Edit `apps/server/wrangler.test.jsonc` — delete the `r2_buckets` block (added in `fbdc26e`).
- [x] 2.2.4 Edit `apps/server/CLAUDE.md` — replace the "Storage destinations" section (lines 82–90, added in `fbdc26e`) with a one-line note: `Managed R2 paused per system-r2-park; dev + prod write paths are BYOS via the StorageWriter interface.`

### 2.3 — Edit `StorageWriter` factory + runs

- [x] 2.3.1 Edit `apps/server/src/lib/storage/storage-writer.ts` — drop the `R2ManagedWriter` import + the `r2_managed` case in `makeStorageWriter`. For the `StorageDestinationType` union: prefer leaving `r2_managed` in the type but marking the factory case unreachable (keeps test types green); only narrow the union if tests stay green after.
- [x] 2.3.2 Edit `apps/server/tests/integration/storage/storage-writer.test.ts` — remove R2 references from fixtures and assertions.
- [x] 2.3.3 Edit `apps/server/src/lib/runs/start.ts` (lines 23–24, 123) — flip the validation from `storageType === "r2_managed"` (must be R2) to `storageType !== "r2_managed"` *and* requires a connected row in `storage_destinations`. Surface a clear error message if no destination is connected.
- [x] 2.3.4 Edit `apps/server/tests/integration/runs-start.test.ts` (lines 75, 284) — swap fixtures from `storageType: "r2_managed"` to `"google_drive"` with a stubbed `storage_destinations` row for the Space under test. _Implemented: `makeConfig()` default is now `google_drive` + a `makeDestination()` factory was added + the deps bag carries a `fetchStorageDestinationBySpace` mock. The pre-existing "returns unsupported_storage_type when storageType is not 'r2_managed'" test was replaced by two new cases: "returns managed_r2_paused when storageType is 'r2_managed'" and "returns no_storage_destination when no BYOS row is connected." Required side-edits: a new `StorageDestinationRow` import (already in `apps/server/src/db/schema/storage-destinations.ts`), a new `fetchStorageDestinationBySpace` field on `ProcessRunStartDeps` in `apps/server/src/lib/runs/start.ts`, the matching production wiring in `apps/server/src/lib/runs/start-deps.ts`, a new `no_storage_destination` error code, the rename `unsupported_storage_type` → `managed_r2_paused`, and the matching status-mapping update in `apps/server/src/pages/api/internal/runs/start.ts`. SpaceDO + the route handler both wire through `buildRunStartDeps` so they get the new fetcher for free._

## Phase 3 — Frontend code rollback (`apps/web`)

Same commit as Phase 2, OR paired follow-up — both touch `storageType` defaults. The drizzle migration must be generated, applied locally, and surfaced for human-test before commit.

### 3.1 — MVP allowlist + integration defaults

- [x] 3.1.1 Edit [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts) (lines 12, 35–36) — flip MVP allowlist from `["r2_managed"]` to a BYOS-only list. Recommended starting list: `["google_drive"]` (only provider with a shipped Connect flow as of `cea7f08`). Expand to other providers as their Connect flows ship.
- [x] 3.1.2 Edit [apps/web/src/lib/integrations.ts](../../../apps/web/src/lib/integrations.ts) (lines 140, 149) — change default `storageType` from `r2_managed` to `null`. UI must force the user to connect a BYOS destination before they can configure a backup.
- [x] 3.1.3 Edit [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/connections.ts) (line 30) — update the inline comment so it no longer references managed R2 as the default.

### 3.2 — StoragePicker + API validation

- [x] 3.2.1 Edit [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro) — lock the `r2_managed` option behind a `Coming soon` / `Paused` label (or remove it entirely from the option list — implementer's call based on what reads more honestly in the UI). Surface Google Drive as the recommended default.
- [x] 3.2.2 Edit [apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts) (lines 6–8) — update the MVP-rule comment and ensure server-side validation matches the new allowlist from 3.1.1.

### 3.3 — Schema + migration

- [x] 3.3.1 Edit [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — remove `.default('r2_managed')` on `backup_configurations.storageType` (line 412). **Leave** the `storage_destinations.type` CHECK constraint untouched (line 524). _Implemented: the column was also stripped of `.notNull()` so existing INSERT sites that omit `storageType` continue to work (the column now carries NULL until the user connects a BYOS destination). The `BackupPolicy.storageType` type in [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/connections.ts) widened from `string` to `string | null` to match._
- [x] 3.3.2 Generate `apps/web/drizzle/0012_pause_r2_default.sql` via `pnpm --filter @baseout/web db:generate`. The migration body should be a single `ALTER TABLE baseout.backup_configurations ALTER COLUMN storage_type DROP DEFAULT;`.
- [x] 3.3.3 Verify the regenerated drizzle snapshot matches the schema diff via `pnpm --filter @baseout/web db:check`.
- [x] 3.3.4 Apply locally before any UI smoke: `pnpm --filter @baseout/web db:migrate`.

### 3.4 — Test fixtures

- [x] 3.4.1 Edit [apps/web/tests/integration/backup-config-persist.test.ts](../../../apps/web/tests/integration/backup-config-persist.test.ts) (line 42) — swap fixture to `google_drive` with a stubbed `storage_destinations` row.
- [x] 3.4.2 Edit [apps/web/tests/e2e/backup-happy-path.spec.ts](../../../apps/web/tests/e2e/backup-happy-path.spec.ts) (lines 17, 19) — rewrite to assert against a Drive-connected fixture. _Implemented: the spec comments were updated to name BYOS / Google Drive as the destination (the literal "real R2" reference is now framed historically). The load-bearing change is in the seed endpoint [apps/web/src/pages/api/internal/test/seed-backup-happy-path.ts](../../../apps/web/src/pages/api/internal/test/seed-backup-happy-path.ts): a new step 10b INSERTs a `storage_destinations` row of type `google_drive` paired with the now-`google_drive` `backup_configurations.storageType` so the engine's `managed_r2_paused` + `no_storage_destination` guards both pass. Paired [seed-workspace-rediscovery.ts](../../../apps/web/src/pages/api/internal/test/seed-workspace-rediscovery.ts) also flipped to `google_drive` (no destinations row needed — that spec doesn't exercise run-start)._
- [x] 3.4.3 Out-of-band fixture cleanup — sweep `r2_managed` placeholder strings in unrelated test fixtures so the codebase is internally consistent. Files touched: [backup-runs/list.test.ts](../../../apps/web/src/lib/backup-runs/list.test.ts), [backups/save-config.test.ts](../../../apps/web/src/lib/backups/save-config.test.ts), [backup-runs.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-runs.test.ts), and the backup-config route test [backup-config.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-config.test.ts) (this last one was a real failure — the happy-path body sent `storageType: 'r2_managed'` which now returns 422 instead of 200). Also flipped the unauthed fallback `policy.storageType` in [index.astro](../../../apps/web/src/pages/index.astro) + [integrations.astro](../../../apps/web/src/pages/integrations.astro) from `'r2_managed'` to `null` (matches the new `BackupPolicy.storageType: string | null` shape from 3.3.1)._

## Phase 4 — Product-spec touch-ups (light)

One row per file. Because this is a pause not a pivot, edits are minimal.

- [x] 4.1 Edit [shared/Baseout_PRD.md](../../../shared/Baseout_PRD.md) §7.2 destinations table — change the R2 row from `Cloudflare R2 (Baseout-managed) — ✓ (default)` to `Cloudflare R2 (Baseout-managed) — V2 (paused per system-r2-park)`. _Implemented: the literal row in PRD §7.2 was `Cloudflare R2 | ✅ V1 (new — internal managed storage)` — flipped to `Cloudflare R2 (Baseout-managed) | ⏸ V2 (paused per system-r2-park)` to match the spec intent against the file's actual wording._
- [x] 4.2 Edit [shared/Baseout_PRD.md](../../../shared/Baseout_PRD.md) §20.2 — update the encryption claim from "managed-R2 server-side encryption + …" to "BYOS-provider TLS + encryption-at-rest; managed-R2 path paused." _Implemented: §20.2 row "Backup files (R2 managed) | Cloudflare R2 server-side encryption | …" rewritten to "Backup files (BYOS destinations) | BYOS-provider TLS in transit + provider-managed encryption at rest | Customer-owned storage (Google Drive, Dropbox, Box, OneDrive, S3, …); managed-R2 path paused per system-r2-park."_
- [x] 4.3 Edit [shared/Baseout_Features.md](../../../shared/Baseout_Features.md) §6.6 — same row update as 4.1. _Implemented: §6.6 row `| **Cloudflare R2** | Managed | Internal | No | All |` flipped to `| **Cloudflare R2 (Baseout-managed)** | Managed | Internal | No | ⏸ V2 (paused per system-r2-park) |`._
- [x] 4.4 Edit [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md) — mark R2-keyed items deferred (grep `r2` in the file). _Implemented: added a top-of-file `⏸ R2 deferral notice` callout (just below the existing `>` quote block) that names every R2-keyed parent + sub-issue (P0.6.2, P1D.1.*, P1B.4.3, P1B.4.7, P1B.5.5, prod/staging bucket provisioning) and routes them to a future `system-r2-revive` change. Inline per-row edits across ~30+ scattered R2 references were ruled out as drive-by churn — a single top-of-file callout reads more honestly given the volume._
- [x] 4.5 Edit [shared/Baseout_Implementation_Plan.md](../../../shared/Baseout_Implementation_Plan.md) — add a one-line note where R2 is referenced as a build step: the R2 step is paused; BYOS-first replaces it. _Implemented: added a top-of-file `⏸ R2 build steps paused` callout between the metadata header and `## Overview` that names every R2 build-step reference in the file (staging R2 namespace, "CSV export to R2 (managed storage default)," StoragePicker R2 default, R2 managed storage destination row, R2 usage summary widget). Same single-callout rationale as 4.4 — the alternative of editing 5 scattered table cells would have been drive-by churn._

## Phase 5 — Memory hygiene

- [x] 5.1 Update [`project_r2_informal_veto.md`](file:///Users/autumnshakespeare/.claude/projects/-Users-autumnshakespeare-baseout/memory/project_r2_informal_veto.md) — change the title and body from "informal veto" to "documented pause via system-r2-park." Reference this change's archive path once it lands. _Implemented: the memory file was renamed `project_r2_informal_veto.md` → `project_r2_documented_pause.md` (the old filename was load-bearing on "informal," so a rename communicates the state change more honestly than an in-place rewrite). Frontmatter `name:` slug flipped `project-r2-informal-veto` → `project-r2-documented-pause`; `description:` rewritten to "Managed Cloudflare R2 is paused (not deleted) per openspec change system-r2-park; BYOS destinations are the only writeable storage path in V1." Body now describes the pause shape (code deletion, schema default drop, three downstream proposals parked, product specs touched), the cost rationale, and a how-to-apply that points future contributors at a hypothetical `system-r2-revive` change. The archive path (`openspec/changes/archive/2026-05-20-system-r2-park/`) is named explicitly with a TODO to update once this change archives. No other memory files wikilinked to the old slug, so no follow-up renames were needed._
- [x] 5.2 Update the matching one-line entry in [`MEMORY.md`](file:///Users/autumnshakespeare/.claude/projects/-Users-autumnshakespeare-baseout/memory/MEMORY.md) to match the new title. _Implemented: the MEMORY.md line `- [Managed R2 informally vetoed by boss; docs still say it's the default](project_r2_informal_veto.md) — …` flipped to `- [Managed R2 paused per openspec system-r2-park](project_r2_documented_pause.md) — R2 binding/strategy/test deleted; storageType default dropped; BYOS-only in V1 (Drive shipped, Dropbox next). Revival = future system-r2-revive change`. Both the link target and the hook reflect the new state-of-record._

## Verification

Per the local-only-commits workflow, surface each commit's smoke commands to the user for human-test approval before committing. Never push, never open a PR.

1. **Typecheck both apps** after Phases 2 + 3:
   ```
   pnpm --filter @baseout/server typecheck
   pnpm --filter @baseout/web typecheck
   ```

2. **Unit + integration tests** after Phases 2 + 3:
   ```
   pnpm --filter @baseout/server test
   pnpm --filter @baseout/web test
   ```
   R2-referencing tests should be deleted or rewritten; none should be skipped.

3. **Schema drift check** after Phase 3.3:
   ```
   pnpm --filter @baseout/web db:check
   ```
   Confirms `0012_pause_r2_default.sql` matches the schema diff.

4. **Apply migration to local Postgres** before any UI smoke (per `feedback_schema_migrate_before_ship`):
   ```
   pnpm --filter @baseout/web db:migrate
   ```

5. **OpenSpec validation** after Phase 1:
   ```
   pnpm openspec validate system-r2-park
   pnpm openspec validate server-byos-destinations
   pnpm openspec validate server-attachments
   pnpm openspec validate server-retention-and-cleanup
   ```

6. **Dev smoke (apps/server)** after Phase 2:
   ```
   pnpm --filter @baseout/server dev
   ```
   Confirm boot succeeds without `BACKUPS_R2` in the env. Workflows still writes to `apps/server/.backups/` via `local-fs-write.ts` — that path is unchanged.

7. **Dev smoke (apps/web)** after Phase 3:
   ```
   pnpm --filter @baseout/web dev
   ```
   Open the backup-config screen, confirm the StoragePicker no longer offers managed R2 as a selectable default and Google Drive is the recommended option.

8. **Manual: confirm no Cloudflare R2 bucket has been provisioned** (`baseout-backups-dev` should not exist on the account). If it does, ask the user before deleting.

9. **Per-commit grep** for stray `console.*` and `debugger` in the staged diff (per CLAUDE.md §3.5):
   ```
   git diff --cached -G 'console\.|debugger' --name-only
   ```

10. **After all phases land**: this change is ready for archival. Confirm via `pnpm openspec list` that `system-r2-park` is present and the four cross-referenced changes (`server-byos-destinations`, `server-attachments`, `server-retention-and-cleanup`, plus this one) all validate.

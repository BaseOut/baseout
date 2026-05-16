> **Blocked tasks**: Every task in Phase B and beyond depends on [`baseout-server-byos-destinations`](../baseout-server-byos-destinations/proposal.md) Phase 0 landing first (R2 binding + `StorageWriter` interface). Phase A (schema) is independent and can ship before that. Tasks below are flagged where blocked.

## Phase A — Schema

### A.1 — Migration

- [ ] A.1.1 Generate `apps/web/drizzle/0009_attachment_dedup.sql` per design.md §"Master DB migration". Drizzle-authored.
- [ ] A.1.2 Apply via `pnpm --filter @baseout/web db:migrate`. Verify with `psql $DATABASE_URL -c "\d baseout.attachment_dedup"`.
- [ ] A.1.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — add `attachmentDedup` table definition.

### A.2 — Engine mirror

- [ ] A.2.1 New file `apps/server/src/db/schema/attachment-dedup.ts`. Header comment naming the canonical migration.
- [ ] A.2.2 Export from the engine schema barrel.

## Phase B — Downloader module

### B.1 — Pure helpers

- [ ] B.1.1 TDD red: `apps/server/tests/integration/attachments/composite-id.test.ts`. Pin the format against the PRD §2.8 example.
- [ ] B.1.2 Implement `apps/server/src/lib/attachments/composite-id.ts` — `compositeIdFor({ baseId, tableId, recordId, fieldId, attachmentId })` and `r2ObjectKeyFor(spaceId, compositeId, filename)` pure functions.

### B.2 — Downloader (moved to workflows sibling)

The downloader implementation, field-normalizer integration, and per-task plumbing are owned by [`baseout-workflows-attachments`](../baseout-workflows-attachments/tasks.md). The server side owns the dedup-lookup engine-callback endpoint that the workflows downloader hits.

- [ ] B.2.1 New `apps/server/src/pages/api/internal/attachments/lookup.ts` — POST `{ baseId, tableId, fieldId, hash, sizeBytes }` → returns existing `{ key }` or null. INTERNAL_TOKEN-gated.
- [ ] B.2.2 Vitest under `apps/server/tests/integration/attachments-lookup-route.test.ts`. Cases: 401 no token, hit, miss, malformed body 400.

### B.4 — Dry-run feature flag (workflows sibling owns; documented here)

`ATTACHMENTS_DRY_RUN` env var on the Trigger.dev runner; downloader logic in `baseout-workflows-attachments` honors it.

### B.5 — Backup-base task test extension (moved)

Per-task integration test (`backup-base-task.test.ts` with attachments fixture) lives under `apps/workflows/tests/` per the workspace split. Tracked in `baseout-workflows-attachments` Phase 4.

## Phase C — Observability

### C.1 — Progress shape

- [ ] C.1.1 Update the `/runs/progress` payload shape in `apps/server/src/pages/api/internal/runs/progress.ts` to accept `attachmentsDownloaded: number`. Mirror in apps/web's progress consumer.
- [ ] C.1.2 Update [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) to expose the new field.
- [ ] C.1.3 Update [apps/web/src/stores/backup-runs.ts](../../../apps/web/src/stores/backup-runs.ts) to surface `attachmentsDownloaded` per run.

### C.2 — Completion summary

- [ ] C.2.1 Extend the `/runs/complete` route handler to accept `attachmentCountByBase: { [baseId]: number }` in the payload. The workflows-side task posts it per `baseout-workflows-attachments`.
- [ ] C.2.2 Aggregate into `backup_runs.attachment_count` in the existing `applyRunCompletion` path.

### C.3 — Structured logs

- [ ] C.3.1 Add `attachment_dedup_hit` and `attachment_dedup_miss` log events inside the downloader.
- [ ] C.3.2 Emit per-run aggregate `backup_run_attachments_summary` in the final completion log.

## Phase D — Trial cap interlock (cross-change)

This phase documents the integration points; actual implementation depends on `baseout-backup-trial-quota-enforcement` shipping.

- [ ] D.1 Document the two integration points in `apps/server/src/lib/runs/start.ts` (pre-flight quota check) and `attachment-downloader.ts` (mid-run cap check).
- [ ] D.2 Add a TODO comment in each location with the openspec change name.
- [ ] D.3 Once the quota change lands, file a follow-up commit that wires them together. Out of this change's verification scope.

## Phase E — Pro+ opt-out toggle (optional)

May be deferred to a separate `baseout-backup-attachments-opt-out` change if review burden is high.

### E.1 — Schema + capability

- [ ] E.1.1 Migration: `apps/web/drizzle/0010_skip_attachments_toggle.sql` adds `skip_attachments boolean NOT NULL DEFAULT false` to `backup_configurations`.
- [ ] E.1.2 Update both schema files (web canonical + engine mirror).
- [ ] E.1.3 Update `apps/web/src/lib/billing/capabilities.ts` — `resolveAttachmentSkip(tier) → { editable: tier >= 'pro', default: false }`.

### E.2 — PATCH validation + UI

- [ ] E.2.1 Update the `PATCH /api/spaces/:id/backup-config` route to validate `skip_attachments` against tier. Lower tiers cannot set `true`.
- [ ] E.2.2 Add a toggle to the per-Space backup config UI (Pro+ only, disabled-with-tooltip for lower tiers).

### E.3 — Engine path

- [ ] E.3.1 `attachment-downloader.ts` reads `skip_attachments` from the config; when `true`, skips the download path and falls back to the legacy placeholder.
- [ ] E.3.2 Test: Pro+ opt-out → CSV cells contain `[N attachments]`, zero R2 writes, dedup table untouched.

## Phase F — Documentation scope-lock

- [ ] F.1 Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) "Out of Scope" table — link this change as the resolved follow-up.
- [ ] F.2 Update [openspec/changes/baseout-server/proposal.md](../baseout-server/proposal.md) Out-of-Scope section if it references attachments as a placeholder.

## Phase G — Final verification

- [ ] G.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] G.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] G.3 Human checkpoint smoke: kick off a backup of a real dev base with at least 10 attachments. First run: assert R2 receives N puts, dedup table has N rows. Second run on same base: assert R2 puts ≈ 0 (new only), dedup `last_seen_at` updated for the existing rows. Inspect a generated CSV — assert cells contain R2 keys, not placeholder text.
- [ ] G.4 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `baseout-backup-attachment-checkpointing` — Resumable per-task attachment processing for very large bases. MVP relies on dedup-on-retry; this adds explicit checkpoint state.
- [ ] OUT-2 `baseout-backup-attachment-restore` — Restore path that maps composite IDs back to Airtable uploads. Depends on the restore engine landing.
- [ ] OUT-3 `baseout-backup-attachment-dedup-by-content` — Dedup by `content_hash` rather than composite ID; catches the case where the same file is re-uploaded under a new attachment ID.
- [ ] OUT-4 `baseout-backup-attachments-opt-out` (if Phase E is deferred) — Pro+ opt-out toggle as a standalone change.
- [ ] OUT-5 `baseout-backup-attachment-cdn-signing` — Customer-facing signed URLs for direct R2 attachment access. Restore-adjacent.

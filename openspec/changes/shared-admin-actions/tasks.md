# Tasks — shared-admin-actions

## 1. `admin_audit_log` schema (web canonical + admin writable mirror)

- [x] 1.1 Add `adminAuditLog` to `apps/web/src/db/schema/core.ts` (next to `connectionStatusAudit`): `id` uuid, `phase` ('intent'|'result'), `intent_id`, `actor_user_id`/`actor_email` (snapshots, no FK), `action`, `target_type`, `target_id`, `organization_id`, `params` jsonb, `created_at`, db-context columns (`db_user`, `application_name`, `txid`); indexes on `(created_at)`, `(target_type, target_id, created_at)`, `(actor_user_id, created_at)`.
- [x] 1.2 `npx drizzle-kit generate --name admin_audit_log` → `drizzle/0025_admin_audit_log.sql`; applied with `db:migrate` to the dev DB (table verified present). (No `db:generate` script exists — drizzle-kit invoked directly.)
- [x] 1.3 Writable mirror added to `apps/admin/src/db/schema/core.ts`: `adminAuditLog` (app-written columns; db-context columns left to their DB defaults), `backupConfigurationBases`, `connections.modifiedAt`. Header documents the exact write scope; never `*_enc`.

## 2. Pure libs (TDD — test first per module)

- [x] 2.1 `apps/admin/src/lib/origin.ts` + test (7): `checkOrigin` — strict origin equality, missing/unparseable header rejected.
- [x] 2.2 `apps/admin/src/lib/audit.ts` + test (6): `runAudited` — rate guard, intent-failure blocks execute, result row on success/domain-failure/exception, result-insert failure swallowed. Drizzle wiring in `src/lib/audit-db.ts` (shared by all routes; ISO-string timestamptz per the postgres-js Date trap).
- [x] 2.3 `apps/admin/src/lib/backup-engine.ts` + test (8): slim client (`startRun`/`cancelRun`), web-matching error-code vocab, null-guard factory.
- [x] 2.4 `apps/admin/src/lib/actions/force-backup.ts` + test (6): connection/base preconditions, `triggered_by='admin'` INSERT, engine start, orphan DELETE (swallowed failure).
- [x] 2.5 `apps/admin/src/lib/actions/invalidate-connection.ts` + test (5): flip-then-cancel with per-run outcomes; `skipped_no_engine` degradation; engine throw → per-run failure.
- [x] 2.6 Folded into the route (3.3): force-migration's execute is a single UPDATE — the 404/409 logic lives in the route's pure `handlePost` (tested there); a one-line lib module would be padding.

## 3. API routes (admin's first mutations)

- [x] 3.1 `apps/admin/src/pages/api/actions/force-backup.ts` + test (8): origin → JSON → UUID → 503 `server_misconfigured` pre-audit → space 404 pre-audit → `runAudited`; domain rejections 409, engine failures 502; 405 other verbs.
- [x] 3.2 `.../invalidate-connection.ts` + test (7): 404/409 pre-audit; 200 returns `cancelledRuns`; `previousStatus` in the intent row.
- [x] 3.3 `.../force-migration.ts` + test (8): 404/409 pre-audit; UPDATE `has_migrated=true` only.

## 4. Engine wiring + runbooks

- [x] 4.1 `apps/admin/wrangler.jsonc.example`: `services` block (BACKUP_ENGINE → baseout-server-dev, `remote: true`).
- [x] 4.2 `apps/admin/.dev.vars.example`: `BACKUP_ENGINE_INTERNAL_TOKEN=` documented (parity with web's; bulk-synced — never `wrangler secret put`).
- [x] 4.3 `apps/admin/src/env.d.ts`: `BACKUP_ENGINE` + `BACKUP_ENGINE_INTERNAL_TOKEN` typed on the workerd env.
- [x] 4.4 `shared/internal/ops-setup.md` §1 updated (binding, token parity, degraded mode, migration prereq). oauth-setup.md read; no update needed (no URI/provider/gating change — stated in proposal).

## 5. UI on existing surfaces

- [x] 5.1 `apps/admin/src/lib/ui.ts` (`setButtonLoading` port + `postAction`) and `src/lib/action-confirm.ts` (dialog wiring); shared partial `src/components/ActionConfirm.astro` (native daisyUI dialog; NOT a component library — promotion flagged for a 4th action). Client wiring is smoke-verified (no DOM test env in admin — node-only Vitest).
- [x] 5.2 `connections.astro`: per-row "Invalidate" (hidden when already `invalid`) + ActionConfirm.
- [x] 5.3 `migration.astro`: per pending-org "Mark migrated" + ActionConfirm.
- [x] 5.4 `index.astro` (tracker): per-Space "Force backup" + ActionConfirm; success reloads (run visible on `/backups`).

## 6. Definition of done

- [x] 6.1 Guard test `src/lib/audit-append-only.test.ts`: matcher self-check + no UPDATE/DELETE of `admin_audit_log` anywhere in `apps/admin/src`.
- [x] 6.2 `pnpm --filter @baseout/admin test:unit` (122 tests) + `typecheck` (0 errors) + `build` green; web `typecheck` (0 errors) + `db:check` clean after migration 0025.
- [ ] 6.3 Human smoke: (1) force backup on a seeded Space → run `queued` on `/backups`, two audit rows (intent + result w/ runId) in psql; (2) invalidate an active connection → status flips, trigger row in `connection_status_audit`, in-flight runs cancelled, customer banner shows broken; (3) force-migrate a pending org → leaves `/migration` pending list; (4) 11 rapid actions → 429; (5) foreign-Origin POST → 403.
- [ ] 6.4 Local commit per CLAUDE.md §3.8 after human approval (no push/PR).

# admin-error-triage — tasks

## 1. Schema (apps/web canonical)

- [x] 1.1 Latest migration was 0028 (service_runs); this is 0029.
- [x] 1.2 Added `adminErrorAcks` to `apps/web/src/db/schema/core.ts` (append-only, phase/target/state/org/denormalized-actor/note + db-context columns, two indexes). — committed 1b845e5.
- [x] 1.3 Migration `0029_admin_error_acks.sql` generated (additive-only). `db:migrate` on deploy.

## 2. Admin mirror + classifier lib (TDD)

- [x] 2.1 Mirrored `admin_error_acks` into `apps/admin/src/db/schema/core.ts` (read+INSERT-only header; no FKs; no *_enc). Also added `space_databases.modified_at` + `connections.pending_reauth_at` to the admin mirrors (occurrence-time columns for the classifier).
- [x] 2.2/2.3 `src/lib/errors.ts` (green): normalizes the five sources into `ErrorItem`, connection `stateFingerprint` (status or hashed refresh-error), per-source occurrence time, org grouping newest-first, ack resolution (latest phase; connection fingerprint must match), `countOpenErrors()`. 6 tests.
- [x] 2.4 `error-acks-guard.test.ts`: no UPDATE/DELETE call site against `admin_error_acks` (INSERT permitted).

## 3. Ack actions (TDD)

- [x] 3.1 `acknowledge-error.test.ts` (9): happy path (intent+result audit rows + ack row), un-ack phase/action, note excluded from audit params (`hasNote` only), cross-origin 403 no-writes, rate-limit 429, unknown target_type 400.
- [x] 3.2 `/api/actions/{acknowledge,unacknowledge}-error` through `runAudited()` (new `acknowledge_error`/`unacknowledge_error` actions + widened `AuditTargetType`); shared `handleAckPost(phase, …)`; connection `targetState` captured.

## 4. `/errors` page

- [x] 4.1 `src/pages/errors/index.astro`: org-grouped queue, `?type=` + `?ackState=` (open|acked|all) filters, per-item Space/Org context, truncation note.
- [x] 4.2 Ack/un-ack buttons (note prompt on ack, `postAction` spinner) + re-hosted Force-backup / Invalidate-connection buttons on eligible items (invalidate hidden when already `invalid`), submitting to the existing action routes.
- [x] 4.3 "Errors" added to the admin nav.

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/admin` astro-check 0 errors + full Vitest 228 (incl. errors 6, guard 2, ack 9). web `db:generate` additive (0029).
- [ ] 5.2 **DEFERRED (human smoke, local):** seed a failed run + `invalid` connection; verify grouping, ack → leaves default view, un-ack → returns, force-backup from the queue, audit rows on `/audit`.
- [ ] 5.3 **DEFERRED (deploy):** `baseout-admin-dev` deploy + repeat smoke.
- [x] 5.4 `admin-operations-overview` (C.5) will import `countOpenErrors()` for its dashboard tile (exported here).

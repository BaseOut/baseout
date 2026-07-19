# admin-error-triage — tasks

## 1. Schema (apps/web canonical)

- [ ] 1.1 Check `apps/web/drizzle/` for the latest applied migration number (other in-flight changes may have landed since this spec was written)
- [ ] 1.2 Add `adminErrorAcks` to `apps/web/src/db/schema/core.ts` per the design DDL (append-only header comment naming this change as owner, `phase`/`target_type`/`target_id`/`target_state`/`organization_id`/denormalized actor columns/`note`/db-context columns, two indexes)
- [ ] 1.3 Generate the migration (`pnpm --filter @baseout/web db:generate`), verify it is additive-only, and apply it (`pnpm db:migrate`)

## 2. Admin mirror + classifier lib (TDD)

- [ ] 2.1 Mirror `admin_error_acks` into `apps/admin/src/db/schema/core.ts` (header comment naming the canonical web migration; no FKs; never `*_enc`)
- [ ] 2.2 Write failing Vitest specs for `apps/admin/src/lib/errors.ts`: normalization of each of the five sources into `ErrorItem`, connection `state_fingerprint` derivation (error-class prefix hashing), occurrence-time selection per source, org grouping + newest-first sort, ack-state resolution (latest `phase` wins; connection fingerprint match required), and `countOpenErrors()`
- [ ] 2.3 Implement `errors.ts` to green: five bounded Drizzle queries (LIMIT 200/source), pure normalizer/merger, ack join, truncation flags
- [ ] 2.4 Extend the append-only guard test to assert no UPDATE/DELETE call sites exist for `admin_error_acks`

## 3. Ack actions (TDD)

- [ ] 3.1 Write failing route tests for `/api/actions/acknowledge-error` and `/api/actions/unacknowledge-error`: happy path (audit intent/result + ack row), cross-origin 403 with no writes, rate-limit 429, unknown `target_type` 400, note excluded from audit `params` (`hasNote` only)
- [ ] 3.2 Implement both routes through `runAudited()` with new action values `acknowledge_error`/`unacknowledge_error` (target validation, `target_state` capture for connection targets)

## 4. `/errors` page

- [ ] 4.1 Build `apps/admin/src/pages/errors/index.astro`: org-grouped queue, type + ack-state filters via query params, per-item Space/Org/drill-in links, truncation banner, `?page=` org-group pagination
- [ ] 4.2 Add ack/un-ack buttons (confirmation dialog, `setButtonLoading`, note textarea in the ack dialog) and re-host the existing Force backup / Invalidate connection buttons on eligible items (invalidate hidden when already `'invalid'`)
- [ ] 4.3 Add "Errors" to the admin nav in `SidebarLayout.astro`

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/admin test`, `typecheck`, `build` all green; `pnpm --filter @baseout/web db:check` clean
- [ ] 5.2 Human smoke (local): seed a failed run + an `invalid` connection in dev; verify grouping, ack → disappears from default view, un-ack → returns, force-backup from the queue starts a run, audit rows visible on `/audit`
- [ ] 5.3 Deploy `baseout-admin-dev` via `pnpm --filter @baseout/admin run deploy`; repeat smoke deployed
- [ ] 5.4 If `admin-operations-overview` has landed: wire its dashboard error counts to `countOpenErrors()`

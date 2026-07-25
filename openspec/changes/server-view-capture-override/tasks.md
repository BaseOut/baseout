## 1. Override

- [x] 1.1 Type `VIEW_CAPTURE_OVERRIDE?: string` on the engine `Env` (`apps/server/src/env.ts` / worker config typing, matching how other optional vars are declared).
- [x] 1.2 TDD (red first): route-level resolution — `"1"` ⇒ gate open without touching the DB resolver; unset/other values ⇒ resolver path unchanged. If the resolution stays inline in the route, extract a pure `resolveViewCaptureSetting(envValue, resolveFromDb)`-style seam into `view-capture.ts` so it is unit-testable next to `isEnterpriseViewCapture`.
- [x] 1.3 Wire into `spacesSchemaSyncHandler`: short-circuit before `resolveViewCaptureForRun`; response `viewCapture: true | false | "override"`.
- [x] 1.4 Add `VIEW_CAPTURE_OVERRIDE=1` to `apps/server/.dev.vars` (and `.dev.vars.example` if the repo carries one) — dev Worker only; do NOT add to staging/prod secret sets.

## 2. Unknown-sweep

- [x] 2.1 TDD (red first, pure where possible): `markViewsUnknownForBase` — targets only `base_id` + `status='active'`, no `first_unseen_run` stamp. (Drizzle io lives in `space-db-pg.ts`; if the WHERE/SET shape is trivial enough to pin via the io module's existing smoke-verified pattern, pin the route-level call condition instead: sweep called iff gate closed.)
- [x] 2.2 Implement the helper + call it from the schema-sync transaction when `viewCapture` is falsy.
- [x] 2.3 Verify reappearance needs no code: extend `schema-diff.test.ts`/io expectations if any assumption is violated (insert/seen upsert already sets `status='active'`).

## 3. Verification

- [x] 3.1 `pnpm vitest run tests/integration/per-space tests/integration/spaces-incremental-apply-route.test.ts` + `tsc --noEmit` + build green.
- [x] 3.2 Deployed smoke: deploy dev engine with the var set, run a backup on a non-Enterprise dev connection, confirm (a) response `viewCapture:"override"`, (b) `bo_at_views` rows captured; then unset locally via a temporary redeploy-free check is NOT possible — instead verify the closed path by pointing at the resolver unit tests + one sync with the var removed from `.dev.vars` if practical. → DONE 2026-07-24 (evening): `deploy:dev` synced 19 secrets incl. `VIEW_CAPTURE_OVERRIDE`; full run `59ec0177` on the non-Enterprise connection `d0374502` (`is_enterprise_scope:false`) succeeded (8 tables / 50 records); all 4 `bo_at_views` rows in the pers Space's per-Space DB have `last_seen_run` = this run's three `bo_at_base_runs` ids — on a default-closed gate that capture is only reachable via the override, which stands in for direct response observation ((a) verified by implication; the task doesn't log the schema-sync response body). Closed path: resolver unit tests pin default-closed on ent=false; the var stays in `.dev.vars` deliberately as the standing dev posture (dev connections are non-Enterprise — removing it would stop all dev view capture).
- [x] 3.3 Update `system-per-space-db` tasks.md 8.2 note (dev-caveat sentence) to point at this change once shipped.

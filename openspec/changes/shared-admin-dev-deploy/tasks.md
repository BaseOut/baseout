## 1. Admin deploy pipeline

- [x] 1.1 `wrangler.jsonc.example`: rename worker to `baseout-admin-dev`, pin `account_id f094d60e8a0996752eb1efd971bda45a`, add `vars.WEB_APP_URL = https://baseout-dev.openside.workers.dev`, swap the Hyperdrive placeholder for the shared dev config `ba2652f40f864918a2da0849f24d12a2` (comment the 15-conn shared-pool rationale).
- [x] 1.2 Generalize `scripts/dev.mjs` → `scripts/launch.mjs` with `dev|build` modes (build falls back to a placeholder `localConnectionString` when `DATABASE_URL` is unset, mirroring web's `DEV_DB_PLACEHOLDER`).
- [x] 1.3 Copy `apps/web/scripts/sync-secrets.mjs` → `apps/admin/scripts/sync-secrets.mjs` (header comment names canonical source).
- [x] 1.4 `package.json`: `dev`/`build` via launch.mjs; add `deploy` + `secrets:sync`.
- [x] 1.5 Rewrite stale `.dev.vars.example` to exactly `ADMIN_HANDOFF_SECRET=` (drop MASTER_ENCRYPTION_KEY / GOOGLE_SSO_CLIENT_SECRET / SERVICE_HMAC_TO_BACKUP / DATABASE_URL — nothing reads them; DATABASE_URL lives in `.env`).

## 2. Web handoff path

- [x] 2.1 `src/lib/return-to.ts`: add `resolveLoginCallback(raw, opts)` → relative path | direct absolute (baseout.local dev) | the parameter-less `/api/admin/handoff` for `allowedOrigins` matches (better-auth double-decodes callbackURL — no embedded origins). Tests first in `return-to.test.ts`.
- [x] 2.2 `src/pages/login.astro`: pass `allowedOrigins` from `ADMIN_APP_URL`; emit the resolved callback in `data-return-to`.
- [x] 2.3 `src/middleware.ts`: signed-in `/login` bounce honors an allowed cross-origin returnTo via the handoff route. Pin in `middleware.test.ts`.
- [x] 2.4 New `src/pages/api/admin/handoff.ts` (GET): target = `ADMIN_APP_URL`, require `role='super'`, mint 60s AES-GCM token, 302 to `<adminOrigin>/auth/handoff?token=…` with `no-store`. Test file beside it.
- [x] 2.5 `wrangler.jsonc.example`: dev-only `vars.ADMIN_APP_URL` (comment: do not replicate to staging/prod). `.dev.vars.example`: add `ADMIN_HANDOFF_SECRET`.

## 3. Admin handoff path

- [x] 3.1 New `src/lib/handoff.ts`: AES-GCM decrypt + `{v, st, aud, exp}` verification (pure; WebCrypto helpers copied from web `crypto.ts`). Tests first.
- [x] 3.2 `src/lib/admin-session.ts`: `extractSessionTokenCookie` also accepts `baseout_admin_session` (better-auth cookie first). Extend tests.
- [x] 3.3 New `src/pages/auth/handoff.ts`: verify token, validate session read-only, set `baseout_admin_session` cookie, 302 `/`. Middleware bypasses the gate for `/auth/handoff`.

## 4. Runbooks + docs (same change, §3.7)

- [x] 4.1 `shared/internal/oauth-setup.md`: §1 admin-dev env row (no OAuth URIs registered); §6 deploy command; §8 workers.dev-cookie failure mode.
- [x] 4.2 `shared/internal/ops-setup.md`: deploy subsection + `ADMIN_HANDOFF_SECRET` parity rule.
- [x] 4.3 Root `CLAUDE.md` §6A: deployed-dev story; §3.3 add admin `.dev.vars` to the source-of-truth list.

## 5. Definition of done

- [x] 5.1 `test:unit` + `typecheck` green in web + admin; `pnpm --filter @baseout/admin build` succeeds.
- [ ] 5.2 Human smoke (local): baseout.local login → admin 4332 renders (unchanged path).
- [ ] 5.3 Human smoke (deployed): fresh browser → admin URL → sign-in → magic link → lands back in admin; signed-in staffer → immediate handoff; customer role → 403; web logout kills admin access.
- [ ] 5.4 Regression: Airtable Connect on deployed dev web + local login unaffected.

# Tasks

## 1. Infrastructure & dependencies

- [x] 1.1 Add `better-auth` + `drizzle-orm` to `apps/survey`; install (note repo `minimumReleaseAge` gotcha — `--config.minimum-release-age=0` if metadata-blocked).
- [x] 1.2 Switch `astro.config.mjs` to the Cloudflare adapter unconditionally; verify `pnpm --filter @baseout/survey dev` boots with a local miniflare D1 and no external setup. *(Implementation note: required downgrading `@astrojs/cloudflare` 14→13.7 — v14 peers Astro 7 and crashes dev on Astro 6. v13 runs dev in workerd via @cloudflare/vite-plugin; no `platformProxy` option exists in this line. Env access = `import { env } from 'cloudflare:workers'`; `wrangler types` generates binding types, wired into the typecheck script.)*
- [x] 1.3 Declare the `SURVEY_DB` D1 binding in `wrangler.jsonc` with `migrations_dir`; document `BETTER_AUTH_SECRET` + `RESEND_API_KEY` secrets and the `wrangler d1 create baseout-survey` step in the README (id stays placeholder until provisioned).
- [x] 1.4 Write migration 0001: better-auth core tables (`user` incl. anonymous flag, `session`, `account`, `verification`) + `survey_progress` (id, user_id, email, survey_version, answers JSON, step_idx, timestamps, completed_at; non-unique `(email, survey_version)` index — recency resolves duplicates, per design §3).

## 2. Auth layer

- [x] 2.1 `src/lib/auth.ts`: better-auth server instance — drizzle(D1) adapter, `anonymous` + `magicLink` plugins, 30d cookie session, magic-link callback landing on `/survey`. *(Ownership re-pointing moved to /api/progress adopt-on-read — design §4.)*
- [x] 2.2 `src/lib/email.ts`: `sendMagicLink(email, url)` via Resend HTTP fetch; falls back to logging the URL when `RESEND_API_KEY` is unset (dev).
- [x] 2.3 Mount better-auth handler at `src/pages/api/auth/[...all].ts` (`prerender = false`); client (`createAuthClient` + anonymous/magic-link plugins) lives in the survey page script.

## 3. Progress API

- [x] 3.1 `GET/PUT /api/progress` (session-gated): GET returns `{answers, stepIdx, email, completed}`; PUT upserts answers + step_idx (+ `completed`); both 401 without a session; size/format validation.
- [x] 3.2 Enforce the privacy rule: an anonymous session only reads/writes its own row; email-matched rows only served to sessions that verified that email (adopt-on-read re-points `user_id`).

## 4. Survey flow UI

- [x] 4.1 Email-first start screen in `survey.astro`: email field + report/save-progress copy; on submit → `signIn.anonymous()` + progress row → question 1; inline validation; sessionStorage-only fallback if auth is unreachable.
- [x] 4.2 Autosave: every Next/Back PUTs progress (`keepalive`, fire-and-forget, sessionStorage cache retained); hydrate on load from GET when a session exists (server wins).
- [x] 4.3 Resume routing: valid session + incomplete row → saved step; completed row → thanks; no session → start gate (or resume gate with `?resume=1`).
- [x] 4.4 Splash (`index.astro`): "Resume your survey" button + autosave note; resume gate requests `signIn.magicLink` with a sent-confirmation state and a "start fresh" escape.
- [x] 4.5 Submit path: `completed: true` saved before submit; start-step email rides `answers.email` into `/api/submit`; the bank's trailing email question is skipped when the gate captured it; token → thanks redirect unchanged.

## 5. Verification

- [x] 5.1 Local end-to-end via curl against `astro dev` + miniflare D1: anonymous sign-in → PUT (answers, step 1) → GET returns them → fresh cookie jar → magic-link request → link from dev log → verify 200 → GET returns the same row adopted by the verified user. ✅ observed 2026-07-13.
- [x] 5.2 Privacy checks: second anonymous session GET → 404 (cannot see the email's row); no-cookie GET → 401. ✅ observed.
- [x] 5.3 `pnpm --filter @baseout/survey typecheck` (0 errors) + `build` green on the cloudflare adapter.
- [ ] 5.3b Browser walk of the full flow at three breakpoints (start gate → questions → close/reopen resume → magic-link resume → finish) — API layer is smoke-tested; the UI hydration path still needs a human/browser pass.
- [x] 5.4 README updated (flow, secrets, D1 provisioning, dev magic-link log, remaining survey-app task-2 items); D1 provisioning shared with survey-app task 2.1 noted.

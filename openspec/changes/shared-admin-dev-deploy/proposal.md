# shared-admin-dev-deploy

## Why

`apps/admin` runs locally (baseout.local:4332) but has zero deploy story — `wrangler.jsonc.example` carries a placeholder Hyperdrive id, no `account_id`, no deploy scripts. The `admin-foundation` tracer explicitly deferred deploy as a "fast follow-up"; this is that follow-up, scoped to the **dev** environment (`baseout-admin-dev` on workers.dev), mirroring how `baseout-dev` (web) and `baseout-server-dev` (engine) deploy today. Production (`admin.baseout.com`) stays in the deferred `admin` umbrella change.

The blocking design problem: deployed admin lands on `https://baseout-admin-dev.openside.workers.dev` while web serves `https://baseout-dev.openside.workers.dev`. The better-auth session cookie is host-only, and `workers.dev` is on the Public Suffix List, so a `Domain=` cookie across the two is impossible — the interim staff gate (read web's cookie) **cannot work deployed** without help.

## What Changes

- **Deploy pipeline for `apps/admin`**, mirroring web's: `scripts/launch.mjs` (dev|build modes, renders `wrangler.jsonc` from `.example`), `scripts/sync-secrets.mjs` (copy of web's), `package.json` `deploy` script (`build` → `wrangler deploy --config dist/server/wrangler.json` → `secrets:sync` from `.dev.vars`).
- **`wrangler.jsonc.example`**: worker name `baseout-admin-dev`, pinned `account_id`, `vars.WEB_APP_URL`, Hyperdrive binding **reusing the shared dev config `ba2652f40f864918a2da0849f24d12a2`** (same origin pool web/server already use — adds zero new PG connections; a new Hyperdrive config would add a second 15-conn pool against dev PG's ~19 usable connections).
- **Cross-origin auth: short-lived signed handoff token.** Alternatives rejected: custom-domain siblings (changes dev web's origin → invalidates registered OAuth redirect URIs, the recurring Airtable regression, plus DNS ops); Cloudflare Access (can't front workers.dev hostnames; bypasses the `users.role='super'` DB gate). The handoff keeps admin free of better-auth and never mutates sessions (CLAUDE.md §6A):
  - web `/login` accepts the deployed admin origin via `validateReturnTo`'s existing `allowedOrigins` support, sourced from a new dev-only wrangler var `ADMIN_APP_URL`;
  - for a cross-origin (non-baseout.local) allowed match, the magic-link `callbackURL` becomes the **relative, parameter-less** `/api/admin/handoff` (relative ⇒ no `trustedOrigins` change; parameter-less because better-auth's verify endpoint double-decodes the callbackURL and its relative-path safety regex rejects a revealed `https://` — INVALID_CALLBACK_URL, found in deployed smoke 2026-07-13);
  - new web route `GET /api/admin/handoff` (session-gated by existing middleware) targets `ADMIN_APP_URL` (the env's single admin origin), requires `users.role='super'`, mints an AES-256-GCM token (reuses `src/lib/crypto.ts`) over `{v:1, st:<session cookie value>, aud:<adminOrigin>, exp:+60s}` keyed by new shared secret `ADMIN_HANDOFF_SECRET`, and 302s to `<adminOrigin>/auth/handoff?token=…` (`Cache-Control: no-store`);
  - web middleware's signed-in `/login` bounce honors an allowed cross-origin returnTo via the handoff route (today's relative-only `sanitizeReturnTo` would strand a signed-in staffer at `/`);
  - new admin route `/auth/handoff` decrypts (authenticated encryption), checks `exp` + `aud`, validates the session row read-only, sets admin's own host-only cookie `baseout_admin_session=<st>`, 302 `/`;
  - admin's gate accepts either cookie (better-auth cookie first — the local path is unchanged). Web logout deletes the session row, so admin access dies with it.
- **Runbook updates in the same change** (CLAUDE.md §3.7): `oauth-setup.md` (env row, deploy command, new §8 failure mode), `ops-setup.md` (deploy subsection, secret-parity rule), root `CLAUDE.md` §6A.

## Security review points (§3.3)

- **New secret** `ADMIN_HANDOFF_SECRET` (32-byte base64, identical in web + admin `.dev.vars`; synced by the deploy scripts — never `wrangler secret put` by hand).
- **New auth path**: handoff route + admin cookie. Mitigations: 60s TTL, audience-bound, AES-GCM authenticated encryption, staff-role check at mint time, HTTPS-only, `no-store`. The token transits once in a query string — acceptable for an interim staff gate; noted as a hardening follow-up alongside the existing session-HMAC TODO in `admin-session.ts`. Superseded by Google SSO in the `admin` umbrella change.
- **Blast radius**: web's cookie behavior, better-auth config, trustedOrigins, and every OAuth provider flow are untouched. Local dev keeps the direct shared-cookie path.

## Out of scope

Production/staging deploy, custom domains, Google SSO, Cloudflare Access, any new read-only surfaces (see `admin-read-surfaces`).

## Why

`apps/admin` is currently a placeholder Worker that returns `200 "baseout-admin placeholder"` — it has never been a real app (see [`admin`](../admin/proposal.md) §"Status note"). The full operator console described in `admin` is a multi-week, six-phase build (9 surfaces, Google Workspace SSO, manual admin actions, an append-only audit trail, R2 retention). We need something runnable **today** that proves the whole stack is wired end-to-end, so every later surface becomes "just another page."

This change is the **tracer-bullet vertical slice**: scaffold the real Astro SSR Cloudflare app, gate it on an existing staff session, read the master DB, and render **one** PRD-priority surface.

## Relationship to the `admin` umbrella

This is a child of the deferred [`admin`](../admin/) change. `admin` still describes the eventual full console and stays deferred; `admin-foundation` carves out only Phase 0 (foundation) + a minimal Phase 1 (auth) + a single Phase 2 read-only surface. When this lands, the placeholder is gone and `admin`'s remaining phases (other surfaces, manual actions, audit trail, Google SSO) layer on top.

## What Changes

- **Scaffold** `apps/admin` as an Astro SSR app on the `@astrojs/cloudflare` adapter (replacing the placeholder `src/index.ts` Worker), styled with Tailwind + DaisyUI + the shared `@baseout/ui` library — mirroring `apps/web`'s dev/launch scripts and `wrangler.jsonc` shape (Hyperdrive binding + local `DATABASE_URL`). Served on `baseout.local` so it shares the session cookie domain with `apps/web`.
- **Per-request master-DB client** mirroring [`apps/web/src/db/worker.ts`](../../../apps/web/src/db/worker.ts) `createDb`. Because `astro dev` runs SSR inside a **workerd** runner (a direct postgres-js TCP connection to a remote host doesn't work there), the DB is reached through a **Hyperdrive** binding exactly as `apps/web` does: `scripts/dev.mjs` renders `wrangler.jsonc` from `wrangler.jsonc.example`, substituting `DATABASE_URL` into the Hyperdrive `localConnectionString`, and the middleware reads `env.HYPERDRIVE.connectionString`. Plus a **minimal mirror** of only the tables this slice reads — `organizations`, `spaces`, `space_platforms`, `subscription_items`, `sessions`, `users` — each with a header comment naming [`apps/web/src/db/schema/core.ts`](../../../apps/web/src/db/schema/core.ts) (and `auth.ts`) as the canonical migration source. This follows the existing mirror pattern `apps/server` uses for `backup_runs`; it deliberately avoids the in-flight `@baseout/db-schema` core-table extraction.
- **Auth gate reusing customer login** (interim, see below): admin middleware reads the `better-auth.session_token` cookie, looks the token up in `sessions`, checks expiry, joins `users`, and requires `role === 'super'`. Read-only session validation — no `better-auth` runtime in admin. Non-`super` / no session → 403.
- **One read-only surface** — the **Organizations → Spaces tracker** (PRD [§5.4](../../../shared/Baseout_PRD.md) Database Admin Area + [§16.1](../../../shared/Baseout_PRD.md) capability list): list every Organization with its Spaces (name, status, tier from `subscription_items`, platform). In today's tier model each Space *is* the provisioned DB, so this is the PRD's "identify which databases belong to which Organizations" in its simplest honest form.
- **Tests** (Vitest, node): the auth-gate decision (`super` passes; `customer` and no-session → 403) and the org→spaces query shape.

## Interim decisions (carried, to revisit in `admin`)

- **Auth deviation.** `admin`'s design specifies Google Workspace SSO with no shared sessions. This slice instead validates the existing `apps/web` better-auth session and gates on `role === 'super'`. Rationale: Google OAuth rejects the `.local` TLD (same blocker as Drive Connect), so real SSO cannot run locally — magic-link already does. Real Google SSO remains tracked in the parent `admin` change. The admin app stays a fully separate Worker (own deploy, no `better-auth` runtime, read-only session lookup), so this never touches Airtable/customer auth.
- **Role column correction.** The staff role is `users.role` with values `customer | super` (not `user_role = 'admin'` as `CLAUDE.md` §2 loosely states). This slice uses the schema's truth; the `CLAUDE.md` wording should be corrected in a follow-up.

## Sign-in round-trip (cross-app addendum)

Admin has no login of its own, so the un-authenticated 403 routes staff into web's `/login` and back. This makes the slice **cross-app** (touches `apps/web`), so it is effectively a `shared-*` change despite the `admin-foundation` name:

- **web** `src/lib/return-to.ts` (+ test): `validateReturnTo()` open-redirect guard — only round-trips to `baseout.local` (dev) or explicitly allowlisted origins.
- **web** `src/pages/login.astro`: reads `?returnTo=`, validates it, and uses the safe value as the magic-link `callbackURL` (falls back to `/welcome`).
- **web** `src/lib/auth-factory.ts`: adds `http://baseout.local:*` to **dev-only** `DEV_TRUSTED_ORIGINS` so better-auth permits the cross-origin magic-link callback to the http admin origin. The prod admin origin (`admin.baseout.com`) joins `PROD_TRUSTED_ORIGINS` when admin is first deployed.
- **admin** `src/middleware.ts`: the Sign-in CTA links to `${WEB_APP_URL}/login?returnTo=<admin origin>`; the `not-super` case shows an informational page instead (no sign-in prompt).

**Security review points:** (1) `validateReturnTo` is the open-redirect guard and is unit-tested; better-auth's `trustedOrigins` check is defense-in-depth behind it. (2) The trustedOrigins addition is additive and dev-branch-only — it does not touch the prod list or Airtable's OAuth handoff-cookie flow.

## Out of scope (stays in `admin`)

Google Workspace SSO; the other 8 surfaces (subscription dashboard, backup-run viewer, connection health, background-service monitor, migration status, manual admin actions, error log search, audit trail); the append-only audit table + INSERT-only Postgres role; R2 retention/archive; Logpush. Also out **today**: binding `admin.baseout.com` and a production deploy — today's bar is a local run; deploy is a fast follow-up.

## Capabilities

### New Capabilities

- `admin-foundation`: a runnable Astro SSR `apps/admin` app gated on an existing `role='super'` better-auth session, reading the master DB per-request, rendering the Organizations → Spaces tracker read-only surface.

### Modified Capabilities

None — `apps/admin` was a non-functional placeholder; this is its first working implementation.

## Impact

- **App**: `apps/admin/` gains `astro.config.mjs`, `src/pages/`, `src/middleware.ts`, `src/db/`, scaffold scripts, and dependencies (`astro`, `@astrojs/cloudflare`, `tailwindcss`, `drizzle-orm`, `postgres`, `@baseout/ui`, Vitest). `package.json` `build`/`dev` move from the placeholder echo/`wrangler dev` to the Astro pipeline; `wrangler.jsonc` gains a Hyperdrive binding and local `DATABASE_URL`.
- **Consumed packages**: `@baseout/ui`, `@baseout/db-schema` (auth tables), and a local mirror of select `core.ts` tables.
- **Master DB access**: read-only — `organizations`, `spaces`, `space_platforms`, `subscription_items` (surface) and `sessions`, `users` (auth gate). No writes.
- **Secrets**: `DATABASE_URL` (local) / Hyperdrive (deployed). No new external integration, no encryption key (no token decrypt in this slice).
- **Security review points**: a new internal surface that reads operational tables and validates sessions. Gate is server-side in middleware; non-`super` returns 403; no mutating routes; no SQL string concatenation (Drizzle only). Cookie validation is DB-lookup-based (token existence + expiry); HMAC signature verification is a noted hardening follow-up.
- **No change** to `apps/web`, `apps/server`, or `apps/workflows` runtime.

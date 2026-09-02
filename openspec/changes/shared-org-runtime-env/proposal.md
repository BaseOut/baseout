# shared-org-runtime-env

> **Depends on**: shared DigitalOcean Postgres for `env.dev` and `env.staging` (confirmed). **Enables**: per-environment `BASEOUT_ENCRYPTION_KEY` without the staging OAuth-refresh cron decrypt-failing (and invalidating) local/dev Connections.

## Why

Dev and staging share one master DB. Without an Organization-level environment tag, local `pnpm dev` and `console.baseout.dev` see the same Organizations, Spaces, and Connections. Split encryption keys on that layout are unsafe: the engine’s `*/15` Airtable refresh sweep selects every active Connection and decrypts with **this Worker’s** key. The wrong key fails decrypt and can flip the other environment’s Connections to `invalid`.

Local backups would also enqueue against staging Spaces.

## What Changes

- Add `organizations.runtime_env` (`dev` | `staging` | `production`). Existing rows backfill to **`staging`**. New Organizations inherit the Worker’s current env.
- Spaces inherit via `spaces.organization_id` (no Space column).
- Magic-link **login still works**. `getAccountContext` only resolves memberships whose Organization matches this Worker’s env; other-env orgs are hidden.
- Onboarding resume and org insert are env-scoped so a staging owner-org does not capture a local signup.
- Engine: OAuth refresh/keepalive listings and `processRunStart` refuse work whose Organization `runtime_env` ≠ `env.BASEOUT_ENV`.
- `apps/web` wrangler env blocks set `BASEOUT_ENV` (server already has it). Unrecognized/missing env **fails closed** (no org in session; no backups; no cron rows).

## Out of Scope

- Copying staging Organizations into dev
- Changing `organizations.slug` uniqueness (still global)
- Admin console filters (staff may still list every org)
- Webhook-renewal listing filter (follow-up if split keys make it load-bearing)

## Capabilities

- `org-runtime-env`: Organizations are tagged to a runtime environment; session, onboarding, backups, and Airtable token refresh only operate on Organizations for the current Worker env.

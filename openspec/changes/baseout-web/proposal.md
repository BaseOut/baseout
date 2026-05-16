## Why

`apps/web` is the customer-facing surface of Baseout — auth, dashboard, integrations, billing, and the in-product feature surfaces. The work to build it has been happening in the standalone `baseout-starter` repo. With the move to a single monorepo at `github.com/baseout/baseout`, that code lands as `apps/web/` and `baseout-starter` is retired as a source. This change records what is being ported in (the realised slice of the broader v1 vision), what is **not** yet implemented and remains a target for future changes, and the surgical removal of the abandoned `baseout-backup-engine` wiring.

## What Changes

- Port `baseout-starter` HEAD (`29dfb5b`, branch `autumn/fullstack-starter`) into `apps/web/`, renamed to package `@baseout/web`. Working tree only — history is not preserved (the source repo stays as a read-only archive until the port is verified in production).
- Surgical strip of the abandoned `baseout-backup-engine` RPC wiring:
  - Delete `src/lib/backup-engine-client.ts`, `src/pages/api/spaces/[spaceId]/backup-runs/enqueue.ts`, the matching integration test, and `plans/connect-to-baseout-backup-engine.md`.
  - Replace `src/pages/backups.astro` with a placeholder that explains backups runs are paused pending the rebuild of `apps/server` (the engine successor).
  - Drop `BACKUP_ENGINE_URL` and `BACKUP_ENGINE_INTERNAL_TOKEN` from `.env.example` and `wrangler.test.jsonc`.
  - Keep all schema, capability-resolver, /ops scaffold, and backup-config persistence work that landed in the same source commit (those are general infrastructure, not engine-specific).
- Adopt the monorepo wiring: `@baseout/web` workspace package; `apps/web/openspec` symlink to `openspec/changes/baseout-web/` (managed by `scripts/fix-symlinks.js` on `pnpm install`); root `.npmrc` with `${FONTAWESOME_TOKEN}` env-var form replacing the leaked literal.
- Defer (now-explicit non-goals for this change; tracked as future deltas):
  - `@baseout/db-schema` extraction (the `backup_runs` / `backup_configurations` schema stays mirrored in `apps/web/src/db/schema/core.ts`).
  - `@baseout/ui` adoption (the app continues to ship its own `src/components/ui/` + Daisyui).
  - Password / 2FA / SAML auth (magic-link is the only enabled method).
  - WebSocket progress, AI-assisted documentation, embedded-extension mode, migration UX, full BYOS storage flow — all depend on `apps/server` or have their own future change.
  - "Run Backup Now" UI in `/backups` returns when `apps/server` lands.

## Capabilities

This change alters the **status** of every capability listed in the original v1 proposal — it does not introduce new capability names. See [STATUS.md](./STATUS.md) for the per-capability implementation snapshot (Implemented / Partial / Not Yet) drawn from a read of starter HEAD. Spec files under `specs/` continue to describe the intended end-state contracts; individual gaps will be picked up via `opsx:propose <capability>` once this change is archived.

### Modified Capabilities

- `authentication`: implemented with **magic-link only** via better-auth 1.6.5; password / 2FA / SAML are deferred.
- `backups-ui`: page exists; the **Run-Now** form is removed pending `apps/server` rebuild.
- `capability-resolution`: resolver **library** (`src/lib/capabilities/resolve.ts`) implemented; the `/api/me/capabilities` HTTP endpoint and 5-minute cache are deferred.
- `web-email-notifications`: dispatched via the Cloudflare Workers `send_email` binding (see `src/lib/email/send.ts`); only the magic-link template is wired today.
- `dashboard`, `integrations-ui`, `stripe-billing`, `restore-ui`, `schema-ui`, `trial-enforcement`, `onboarding-wizard`: partial; concrete deltas captured in [STATUS.md](./STATUS.md) and [tasks.md](./tasks.md).

### Capabilities Not Yet Implemented

`pre-registration-schema-viz`, `storage-destination-oauth`, `data-intelligence-ui`, `in-app-notifications`, `migration-ux`, `airtable-extension-embedding`. Specs under `specs/` document the target contracts; future `opsx:propose` changes will deliver them.

## Impact

- **New code path**: `apps/web/` (Cloudflare Workers, Astro SSR, port 4331 dev). Replaces the standalone `baseout-starter` repo as the canonical home for customer-app code.
- **External dependencies (used today)**: Cloudflare Workers + Hyperdrive + Email Workers `send_email` binding, DigitalOcean PostgreSQL (master DB), better-auth, Stripe, Airtable OAuth + REST, Tailwind 4 + daisyUI 5, Drizzle 0.45, Astro 6.1, Vitest, Playwright. Deferred: PostHog, dub.co, React Email, React Flow, Floating UI, Shepherd.js — listed in the v1 design but not yet wired.
- **Cross-repo contracts**:
  - With `apps/server` (yet to be rebuilt): the previous direct HTTP RPC wire is removed. When `apps/server` lands, a new openspec change reintroduces the run-trigger and (per the parallel `web-client-isolation` proposal) routes browser traffic through `apps/web` proxies rather than direct cross-origin calls.
  - With `apps/{api,sql,hooks,admin}`: nothing wired today — those apps remain skeleton stubs.
- **Master DB ownership**: unchanged from the v1 proposal in scope — `apps/web` continues to own user-scoped tables (`organizations`, `organization_members`, `connections`, `spaces`, `bases`, `subscriptions`, `subscription_items`, `backup_configurations`, `storage_destinations`, etc.). The `backup_runs` reader path is preserved (the table exists; nothing writes to it until `apps/server` lands).
- **Secrets**: `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY` + `STRIPE_TRIAL_PRICE_ID`, `BASEOUT_ENCRYPTION_KEY`, `AIRTABLE_OAUTH_CLIENT_ID` / `_SECRET`, `DATABASE_URL`. Email transport uses the Cloudflare Workers `send_email` binding declared in `wrangler.jsonc` — no third-party email key required. Removed: `BACKUP_ENGINE_URL`, `BACKUP_ENGINE_INTERNAL_TOKEN`. Workspace-level: `FONTAWESOME_TOKEN`, `NPM_TOKEN` (env-var form in root `.npmrc`).
- **Operational**: dev port 4331 (https via local mkcert); Cloudflare Workers `baseout-dev` / `baseout-staging` / `baseout` (production) targets exist in `wrangler.jsonc` (Hyperdrive IDs filled for dev only — staging / prod still placeholders that need provisioning before deploy).

## Reversibility

The port is a copy-not-move. The source repos at `/Users/autumnshakespeare/dev/baseout/baseout-starter` and `baseout-backup-engine` stay in place as read-only archives until `apps/web` is verified in production. The monorepo working tree is uncommitted at the end of this change — review and commit happens human-driven after the verification gate.

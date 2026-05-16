## 1. Port + monorepo wiring (this change)

- [x] 1.1 Pull planning skeleton (apps/, packages/, openspec/, root configs) into `/baseout` via `git archive origin/main:planning | tar -x`
- [x] 1.2 Sanitize `.npmrc` to env-var form (`${FONTAWESOME_TOKEN}`, `${NPM_TOKEN}`); flag the leaked literal for rotation
- [x] 1.3 Merge `.gitignore` (skeleton's monorepo-aware base + app-level exclusions); delete the 86-byte `package-lock.json` stub
- [x] 1.4 Rsync `baseout-starter` HEAD (`29dfb5b`) into `apps/web/`, excluding `node_modules`, `dist`, `.git`, `.astro`, `.wrangler`, `test-results`, `.superpowers`
- [x] 1.5 Drop `apps/web/package-lock.json` (npm artifact) and `apps/web/.npmrc` (covered by root)
- [x] 1.6 Surgical strip of engine wiring:
  - [x] delete `src/lib/backup-engine-client.ts`
  - [x] delete `src/pages/api/spaces/[spaceId]/backup-runs/enqueue.ts`
  - [x] delete `tests/integration/api-backup-runs-enqueue.test.ts`
  - [x] delete `plans/connect-to-baseout-backup-engine.md`
  - [x] replace `src/pages/backups.astro` with placeholder explaining the deferral
  - [x] strip `BACKUP_ENGINE_URL` + `BACKUP_ENGINE_INTERNAL_TOKEN` from `.env.example`
  - [x] strip `BACKUP_ENGINE_*` vars from `wrangler.test.jsonc`
- [x] 1.7 Rename `apps/web/package.json` → `name: "@baseout/web"`
- [x] 1.8 Rewrite this openspec change folder (proposal, design, tasks, README, STATUS) to mirror starter HEAD reality
- [ ] 1.9 `pnpm install` from repo root (postinstall runs `scripts/fix-symlinks.js`); verify no install errors
- [ ] 1.10 `pnpm --filter @baseout/web build` exits 0
- [ ] 1.11 `pnpm --filter @baseout/web exec astro check` reports 0 errors
- [ ] 1.12 `grep -rn "backup-engine-client\|BACKUP_ENGINE" apps/web/src apps/web/tests` returns nothing
- [ ] 1.13 `pnpm dev:web` boots wrangler dev on https://localhost:4331; `/login`, `/integrations`, `/backups` (placeholder), `/ops` all render

## 2. Implementation status (carried in from starter HEAD)

The following capabilities arrived already-implemented in the port; ticking them off here records the inventory rather than work performed in this change:

- [x] 2.1 Magic-link authentication (better-auth 1.6.5)
- [x] 2.2 Airtable OAuth PKCE flow with AES-256-GCM token storage
- [x] 2.3 Connection state surface in `src/views/IntegrationsView.astro` (active / expired / disconnected + reconnect)
- [x] 2.4 Capability resolver **library** (`src/lib/capabilities/`) — tier from Stripe product metadata
- [x] 2.5 Stripe **trial** customer + subscription creation (`src/lib/stripe.ts`)
- [x] 2.6 Backup-config persistence (`src/lib/backup-config/`) — base inclusion writes
- [x] 2.7 Drizzle migrations 0001–0005 (auth tables, spaces/orgs/connections, billing, user_role + backup_runs, backup_configurations)
- [x] 2.8 `/ops` admin scaffold gated by `users.user_role = 'admin'`
- [x] 2.9 Vendored `@opensided/theme` and `@opensided/openside-identity-schema` (`file:` deps)
- [x] 2.10 Test scaffolds: vitest unit, vitest integration (CF Workers pool + Postgres docker), playwright E2E for magic-link

## 3. Deferred (each becomes its own future `opsx:propose` change)

Listed for traceability; **not** in scope for this change:

- [ ] 3.1 Password / 2FA TOTP / SAML auth → `baseout-web-auth-extended`
- [ ] 3.3 `GET /api/me/capabilities` HTTP endpoint + 5-min cache + `enforceCapability` middleware → `baseout-web-capability-api`
- [ ] 3.4 Stripe webhook receiver, idempotency table, dunning, plan upgrade/downgrade, add-ons, credit packs → `baseout-web-stripe-full`
- [ ] 3.5 BYOS storage destination OAuth (Drive / Dropbox / Box / OneDrive / S3 / Frame.io) → `baseout-web-byos-storage`
- [ ] 3.6 5-step onboarding wizard with `spaces.onboarding_step` resume → `baseout-web-onboarding-wizard`
- [ ] 3.7 Pre-registration schema visualization → `baseout-web-pre-reg-schema-viz`
- [ ] 3.8 Live WebSocket progress (depends on `apps/server`) → `baseout-web-websocket-progress`
- [ ] 3.9 Run-Backup-Now wire reintroduced (depends on `apps/server`) → `baseout-web-run-now`
- [ ] 3.10 In-app notifications panel + preferences → `baseout-web-notifications-ui`
- [ ] 3.11 Schema UI (React Flow + changelog) → `baseout-web-schema-ui`
- [ ] 3.12 Restore UI (snapshot picker + scope picker + post-restore verification) → `baseout-web-restore-full`
- [ ] 3.13 Data / Automations / Interfaces views → `baseout-web-data-views`
- [ ] 3.14 AI-Assisted Documentation (depends on `apps/server`) → `baseout-web-ai-docs`
- [ ] 3.15 Embedded-extension mode (iframe + postMessage) → `baseout-web-embedded`
- [ ] 3.16 Migration UX (`has_migrated` re-auth flow) → `baseout-web-migration-ux`
- [ ] 3.17 Extract `backup_runs` schema to `packages/db-schema` → `baseout-db-schema-backup-runs`
- [ ] 3.18 Promote `vendor/@opensided/theme` → `packages/ui` (or `packages/theme`) once a second consumer exists

## 4. Operational follow-ups (outside the change folder)

- [ ] 4.1 Rotate the leaked Fontawesome token (`9A19FB16-…`) at fontawesome.com; set `FONTAWESOME_TOKEN` in shell rc / direnv
- [ ] 4.2 Provision Hyperdrive IDs for staging + production in `apps/web/wrangler.jsonc`
- [ ] 4.3 Provision KV namespace (`SESSIONS_KV`) for staging + production
- [ ] 4.4 Set `wrangler secret`s per env: `STRIPE_SECRET_KEY`, `STRIPE_TRIAL_PRICE_ID`, `BASEOUT_ENCRYPTION_KEY`, `AIRTABLE_OAUTH_CLIENT_ID/_SECRET`, `BETTER_AUTH_SECRET`, `DATABASE_URL`. Email uses the Cloudflare Workers `send_email` binding declared in `wrangler.jsonc` — no API key needed.
- [ ] 4.5 After verification, archive `/Users/autumnshakespeare/dev/baseout/baseout-starter` and `baseout-backup-engine` (mark read-only; do not delete until prod is on the monorepo)
- [ ] 4.6 Update memory note `project_monorepo_migration.md` to reflect: skeleton was at planning repo HEAD (resolved); engine abandoned; apps/web ported from `29dfb5b` minus engine wire

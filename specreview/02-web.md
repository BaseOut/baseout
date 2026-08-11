## apps/web — Astro SSR customer app

> **Note (2026-05-13 update):** theme-swap shipped, OAuth-callback `returnTo` shipped, Trigger.dev bumped to 4.4.6, cancel-run UI shipped. See [05-update-2026-05-13b.md](./05-update-2026-05-13b.md) for the delta.



### Spec identity

Per `CLAUDE.md` §2:

- User-facing Astro SSR app on Cloudflare Workers
- Auth + magic-link (better-auth)
- OAuth Connect flows (Airtable today; Storage destinations later)
- Integrations dashboard, settings, marketing pages, middleware
- `/ops` staff console
- Owns master-DB schema + migrations
- Sole origin browser talks to (per `web-client-isolation`)
- Calls `apps/server` via service binding (`BACKUP_ENGINE`)

### Canonical proposal: `baseout-web`

The proposal documents what landed via the port from `baseout-starter` HEAD `29dfb5b` (engine wiring stripped). Capabilities live as 17 spec files under `openspec/changes/baseout-web/specs/`.

### Source tree

```
src/
  middleware.ts               Auth + account context
  pages/
    index.astro               Dashboard (space-scoped)
    login.astro
    register.astro
    welcome.astro             Onboarding entrypoint
    integrations.astro        Connection cards + reconnect
    backups.astro             Run history (SSR) + live updates
    restore.astro             Placeholder
    schema.astro              Placeholder
    reports.astro             Placeholder
    help.astro
    profile.astro
    settings.astro
    ops/                      Staff console (admin-gated)
    api/
      auth/                   better-auth routes
      connections/            Airtable OAuth callback, test probe
      dashboard.ts
      me.ts
      onboarding/
      spaces/
        index.ts
        switch.ts
        [spaceId]/            Per-space API surface
      internal/
      stub/
  views/
    DashboardView.astro
    IntegrationsView.astro
    ConnectAirtableModal.astro
    NotFoundView.astro
    PlaceholderView.astro
  components/
    backups/                  Backup widgets (history, frequency, storage pickers)
    layout/                   Sidebar, Header
    ui/                       Daisyui-themed primitives
  layouts/                    Layout.astro, SidebarLayout.astro, AuthLayout.astro
  lib/
    airtable/                 OAuth PKCE, config, oauth.ts
    auth.ts + auth-factory.ts + auth-utils.ts + auth-client.ts
    backup-config/            Base inclusion persistence
    backup-engine.ts          Service-binding-based engine client
    backup-runs/
    backups/
    capabilities/             Resolver lib (Stripe metadata → tier)
    crypto.ts                 AES-256-GCM (encrypt + decrypt)
    config.ts
    dashboard.ts
    email/                    Cloudflare Email Workers (`send_email` binding); magic-link only
    integrations.ts
    onboarding/
    session-cache.ts
    sidebar/
    slug.ts
    spaces.ts
    stripe.ts                 Trial customer + subscription creation
    types.ts
    ui.ts                     setButtonLoading + helpers
  stores/                     nanostores (spaces, backup-runs, etc.)
  db/
    worker.ts                 Per-request Hyperdrive client
    node.ts                   Script singleton
    schema/                   Canonical master-DB schema
  styles/
drizzle/                      Migrations 0001–0005
```

### Capability snapshot (from STATUS.md)

| Capability | Status | Detail |
|---|---|---|
| `authentication` | Partial | Magic-link via better-auth 1.6.5. No password / 2FA TOTP / SAML SSO. |
| `airtable-oauth` (Connection auth) | **Implemented** | Full PKCE in `lib/airtable/oauth.ts`; AES-256-GCM token storage. |
| `pre-registration-schema-viz` | Not Yet | |
| `onboarding-wizard` | Partial | `register.astro` + `welcome.astro` exist. 5-step wizard with `spaces.onboarding_step` resume — not built. |
| `storage-destination-oauth` | Not Yet | Drive / Dropbox / Box / OneDrive / S3 / Frame.io / BYOS Custom — none. |
| `dashboard` | Partial | Workspaces + replication stats. No live progress widget, storage usage card, notifications panel, health score. |
| `backups-ui` | Partial | Page exists; Run-Now removed pending server. Run history list landed. |
| `restore-ui` | Partial | Placeholder route only. |
| `schema-ui` | Partial | Placeholder route only. |
| `data-intelligence-ui` | Not Yet | Data / Automations / Interfaces views. AI-Assisted Documentation depends on server. |
| `stripe-billing` | Partial | Trial customer + subscription create only. No webhook receiver, idempotency table, plan changes, add-ons, credit packs, overage cap config. |
| `capability-resolution` | Partial | Resolver **library** done. `GET /api/me/capabilities` endpoint + 5-min cache + `enforceCapability` middleware — not built. |
| `trial-enforcement` | Partial | 7-day Stripe trial. "1 successful run" trigger + runtime data caps live in server (unbuilt). |
| `in-app-notifications` | Not Yet | |
| `web-email-notifications` | Partial | Cloudflare Email Workers `send_email` binding (NOT Resend, NOT Mailgun). Magic-link template only. `src/lib/email/send.ts` calls `env.email.send({...})`; `EMAIL_FROM` env var is the verified sender. |
| `migration-ux` | Not Yet | |
| `airtable-extension-embedding` | Not Yet | |
| `integrations-ui` | Partial | Connection status + reconnect CTA done. Inbound API token CRUD, SQL REST URL display, Direct SQL string display — depend on api/sql apps (skeletons). |

### Recent shipped work (autumn/server-setup branch — updated 2026-05-13)

```
cddff0c fix(server): green the 3 SpaceDO alarm-storage tests (test-only)
6d887a6 chore(branch): batch-ship in-progress Phase B + theme + openspec proposals
8fc1f61 refactor(server): write backup CSVs to local disk; remove R2 entirely
fc96617 feat(backups): cancel a backup run (Phase A of baseout-backup-schedule-and-cancel)
0d3529d feat(web): re-render page interior on Space switch via ClientRouter
a4f2e4a feat(web): top-level /backups page with SSR run history
d19d72b fix(web): live backup-status chip flip (ClientRouter lifecycle + listener re-arm)
09cdd21 feat(web): live progress counter + 2s polling (Backups MVP Phase 10d)
c505974 feat(web): aria-live polite on backup count line + smooth transition
ce7bf0b feat: live-history polish + OAuth-callback returnTo + Trigger.dev 4.4.6
994f5c6 feat: Phase B1 proactive OAuth refresh cron + always-visible Reconnect
```

These ship as parts of `baseout-backup-history-live-status`, `baseout-web-space-scoped-interior`, `baseout-web-smooth-theme-swap`, `baseout-backup-schedule-and-cancel` (Phase A), and `baseout-server-cron-oauth-refresh`.

### Completed-or-in-flight openspec changes that touch `apps/web`

| Change | State |
|---|---|
| `baseout-web` | Port + strip ✅; verification steps 1.9–1.13 outstanding |
| `baseout-backup-history-live-status` | Phase 1 + Phase 2 ✅ shipped |
| `baseout-web-space-scoped-interior` | ✅ shipped (commit `0d3529d`) |
| `baseout-web-smooth-theme-swap` | ✅ shipped (commit `6d887a6` batch) |
| `baseout-backup-schedule-and-cancel` | Phase A (cancel) ✅; Phase B (scheduled) partial — server side mostly done, apps/web hookup outstanding |
| `baseout-web-server-service-binding` | Dev binding live; `whoami` probe wired |
| `baseout-web-server-service-binding-staging-prod` | Pending Hyperdrive + secrets |
| `web-client-isolation` | Proposal only — wiring partial (whoami via binding); WebSocket / Run-Now / data-read proxies not built |
| `baseout-db-schema` | Proposal only — package not extracted (now mirroring 7 tables) |
| `baseout-admin`, `baseout-api`, `baseout-sql`, `baseout-hooks` | Skeleton stubs (instant-webhook + automations need `apps/hooks` + `apps/api` real Workers) |

### Deferred work (each gets own `opsx:propose`)

From `baseout-web/tasks.md` §3:

- `baseout-web-auth-extended` — password / 2FA / SAML
- `baseout-web-mailgun` — React Email + Mailgun migration
- `baseout-web-capability-api` — `/api/me/capabilities` + cache + enforceCapability
- `baseout-web-stripe-full` — webhook receiver, idempotency, dunning, plan changes, add-ons, credit packs
- `baseout-web-byos-storage` — Storage destination OAuth flows
- `baseout-web-onboarding-wizard` — 5-step wizard with resume
- `baseout-web-pre-reg-schema-viz` — visitor-OAuth → schema graph → claim-on-signup
- `baseout-web-websocket-progress` — depends on server
- `baseout-web-run-now` — depends on server
- `baseout-web-notifications-ui`
- `baseout-web-schema-ui` — React Flow + changelog
- `baseout-web-restore-full` — snapshot picker, scope, post-restore verify
- `baseout-web-data-views` — Data / Automations / Interfaces
- `baseout-web-ai-docs` — depends on server
- `baseout-web-embedded` — iframe + postMessage
- `baseout-web-migration-ux` — has_migrated re-auth flow
- `baseout-db-schema-backup-runs` — extract schema to package
- `packages/ui` extraction — once second consumer exists

### Operational follow-ups

- Rotate leaked Fontawesome token; set `FONTAWESOME_TOKEN` shell var
- Provision Hyperdrive IDs for staging + production
- Provision `SESSIONS_KV` for staging + production
- Set `wrangler secret`s per env: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_TRIAL_PRICE_ID`, `BASEOUT_ENCRYPTION_KEY`, `AIRTABLE_OAUTH_CLIENT_ID/_SECRET`, `BETTER_AUTH_SECRET`, `DATABASE_URL`
- After production verification, archive `baseout-starter` + `baseout-backup-engine` source repos (read-only)

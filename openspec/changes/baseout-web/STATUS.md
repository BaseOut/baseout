# baseout-web — implementation snapshot vs spec

Snapshot taken at the time of porting `baseout-starter` HEAD `29dfb5b` into `apps/web/` (engine wiring stripped).

The `specs/<capability>/spec.md` files describe the **target** SHALL/MUST contracts (the original v1 vision). This file records, for each capability, which clauses are met today and which remain a target.

| Capability | Status | Notes |
|---|---|---|
| `authentication` | Partial | Magic-link only via better-auth 1.6.5. Password / 2FA TOTP / SAML SSO **not implemented**. Airtable-as-login already excluded by design. |
| `airtable-oauth` (Connection auth) | **Implemented** | Full PKCE flow in `src/lib/airtable/oauth.ts`; AES-256-GCM token storage in `connections.tokens_enc`; stub mode for `wrangler --remote` dev. (Not a separately-listed capability in the v1 proposal, but worth flagging.) |
| `pre-registration-schema-viz` | Not Yet | Visitor-OAuth → schema-graph → claim-on-signup is unbuilt. |
| `onboarding-wizard` | Partial | `register.astro` + `welcome.astro` exist; the full 5-step wizard with `spaces.onboarding_step` resume is not implemented. Frequency picker, storage-destination picker, "Confirm + Run First Backup" — none exist. |
| `storage-destination-oauth` | Not Yet | None of Drive / Dropbox / Box / OneDrive / S3 / Frame.io / BYOS Custom flows implemented. |
| `dashboard` | Partial | `DashboardView.astro` lists workspaces + replication stats. Live progress widget, storage-usage card, notifications panel, per-Base health score — not implemented (depend on `apps/server`). |
| `backups-ui` | Partial | Page exists; Run-Now form **removed** pending `apps/server` rebuild. Run history list, audit-report view, run-configuration UI — not implemented. |
| `restore-ui` | Partial | `restore.astro` placeholder route. Snapshot picker, scope picker, destination chooser, post-restore verification — not implemented. |
| `schema-ui` | Partial | `schema.astro` placeholder route. React Flow visualizer, changelog rendering, health-score rule config, diagram export — not implemented. |
| `data-intelligence-ui` | Not Yet | Data / Automations / Interfaces views not implemented. AI-Assisted Documentation deferred (also depends on `apps/server`). |
| `stripe-billing` | Partial | Trial customer + subscription creation in `src/lib/stripe.ts`. Webhook receiver, idempotency table, plan upgrade/downgrade, add-ons, one-time credit packs, overage cap config — none implemented. |
| `capability-resolution` | Partial | Resolver **library** in `src/lib/capabilities/resolve.ts` reads tier from Stripe product metadata. The `GET /api/me/capabilities` HTTP endpoint, 5-minute cache, and `enforceCapability` middleware — not implemented. |
| `trial-enforcement` | Partial | 7-day trial via Stripe trial subscription. The "1 successful run" trigger and runtime data caps (1K records / 5 tables / 100 attachments) live in `apps/server` (not yet rebuilt). |
| `in-app-notifications` | Not Yet | `notifications` table reader, dashboard panel, mark-as-read, preference UI — not implemented. |
| `web-email-notifications` | Partial | Cloudflare Workers `send_email` binding (canonical transport — see `src/lib/email/send.ts`). Magic-link template wired. Password Reset / 2FA setup / Trial Welcome / Migration Welcome / Upgrade Confirmation / Payment Failed / Team Invitation — not implemented. |
| `migration-ux` | Not Yet | "Complete Your Migration" screen + re-auth flows — not implemented. |
| `airtable-extension-embedding` | Not Yet | Frame detection, postMessage framework, compact embedded layout — not implemented. |
| `integrations-ui` | Partial | Connection status surface + reconnect CTA implemented (`src/views/IntegrationsView.astro`). Inbound API token CRUD, SQL REST endpoint URL display, Direct SQL connection string display — not implemented (depend on `apps/api` + `apps/sql`). |

## How to read this

- **Implemented**: spec contract is met by code in `apps/web/src/`.
- **Partial**: a slice of the contract is met; gaps are listed in the Notes.
- **Not Yet**: nothing in `apps/web/` corresponds to this capability today.

Each Partial / Not Yet line is the seed for a future `opsx:propose <capability>` change. The deferred work is enumerated in [tasks.md](./tasks.md) §3.

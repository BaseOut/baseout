## Why

Baseout's front surface — the Astro web app, the customer dashboard, all the web API endpoints (auth, Stripe webhook, Inbound API, capability resolver), the master DB schema, and the front-owned email templates — is the customer-touching layer of the product and the publisher of the `@baseout/db-schema` package the back consumes. None of it exists yet. This change converts the existing `Front_PRD.md` (V1.0) into spec-driven OpenSpec artifacts so the V1 build can be sequenced, tracked, and validated against testable requirements.

## What Changes

- Establish two new repos: `baseout-web` (Astro SSR + web API on Cloudflare Pages + Workers) and `baseout-ui` (shared Astro/React component library, internal npm).
- Define and migrate the master DB schema in Drizzle and publish it as `@baseout/db-schema` for back to consume.
- Implement authentication via better-auth with magic link, email + password, 2FA (TOTP), SSO (SAML for Enterprise), and Airtable OAuth strictly as a Connection auth flow (never a login).
- Build pre-registration schema visualization: visitor OAuths Airtable → views React Flow schema graph → claims session on sign-up.
- Build a 5-step onboarding wizard (Connect → Bases → Frequency → Storage → Confirm + first backup) with `spaces.onboarding_step` as the resume source of truth.
- Build the dashboard with Space selector, backup status widget (live WebSocket → backup-engine DO), backup history, storage usage, notifications panel, and per-Base health score card.
- Build feature surfaces for Backups, Restore, Schema (visualization + changelog + health score + diagram export), Data / Automations / Interfaces (Growth+), AI-Assisted Documentation (Pro+), Analytics (V1 placeholder), Governance (V2 placeholder), Integrations (Inbound API tokens, SQL REST endpoint, Direct SQL string), and Settings.
- Implement the Inbound API (`/api/v1/inbound/*`) — token-authorized, Zod-validated, rate-limited, credit-consuming HTTP layer that forwards writes to back's ingestion endpoint.
- Implement Stripe billing UX (sign-up trial subscription, plan upgrade/downgrade, add-ons, one-time credit packs, overage cap config) and the Stripe webhook receiver (`/api/webhooks/stripe`) with signature verification, idempotency table, and credit-bucket creation on `invoice.paid`.
- Implement the Capability Resolver (`GET /api/me/capabilities`) and `enforceCapability` middleware as the single source of truth for tier-gated feature toggles, never hardcoding tier strings.
- Implement Trial enforcement (7 days OR 1 successful run, whichever first; 1K records / 5 tables / 100 attachments caps enforced by back; per platform + Org, ever).
- Implement in-app notifications surface and front-owned React Email templates (Magic Link, Password Reset, 2FA setup, Trial Welcome, Migration Welcome, Upgrade Confirmation, Payment Failed, Team Invitation) sent via Mailgun with front's own API key.
- Implement Airtable extension embedding (URL-param + frame detection → `window.postMessage` framework → compact embedded layout).
- Build the "Complete Your Migration" UX for migrated On2Air users (re-auth Airtable, re-auth storage destinations, set `has_migrated=true`).
- Mobile-responsive dashboards plus Floating UI tooltips and Shepherd.js guided tours.

## Capabilities

### New Capabilities

- `master-db-schema`: Drizzle schema definition for the master DB with all tables, conventions (snake_case, UUID PKs, `created_at`/`modified_at`, `_enc` suffix for encrypted columns), `drizzle-kit` migration workflow, and `@baseout/db-schema` package publishing for back to consume.
- `authentication`: better-auth integration covering magic link, email + password, 2FA (TOTP), Enterprise SSO (SAML), session management, and the rule that Airtable OAuth is a Connection auth flow only (never a login method).
- `pre-registration-schema-viz`: Visitor-initiated Airtable OAuth without sign-up, ephemeral session for the OAuth token, schema metadata fetch, React Flow visualizer rendering, and session-claim handoff on subsequent sign-up.
- `onboarding-wizard`: Five-step wizard (Connect Airtable → Select Bases → Pick Frequency → Pick Storage Destination → Confirm + Run First Backup), `spaces.onboarding_step` resume, dashboard locked between first-backup-start and first-backup-completion.
- `storage-destination-oauth`: Front-side OAuth/IAM auth flows for Google Drive, Dropbox, Box, OneDrive, S3 (Growth+), Frame.io (Growth+), and BYOS (Pro+); persists `storage_destinations` rows that back consumes for write logic.
- `dashboard`: Space selector, dashboard layout, top-level cards (status, history, storage usage, notifications, health), and the WebSocket client that consumes back's per-Space DO live-progress events.
- `backups-ui`: Backups feature surface — history list, run-now button, audit-report view, run-configuration UI, and the cross-service trigger that POSTs to back's `/runs/{id}/start`.
- `restore-ui`: Restore feature surface — snapshot picker, scope picker (base/table/point-in-time), destination chooser (new base / new table in existing base), submit path that writes `restore_runs` and POSTs to back's `/restores/{id}/start`, status updates, post-restore verification display (Growth+), and the Community Restore Tooling render (Pro+).
- `schema-ui`: Schema visualization (React Flow), changelog rendering from back-computed diffs, health-score display + rule configuration, and diagram export (PNG / SVG / PDF / embed widget per tier).
- `data-intelligence-ui`: Data view, Automations view, Interfaces view (Growth+), and AI-Assisted Documentation generation button (Pro+) with credit deduction and back-write of generated descriptions.
- `inbound-api`: `/api/v1/inbound/*` token-authorized public API with Zod validation, tier-based monthly rate limits, per-call credit consumption, OpenAPI spec at `docs.baseout.com`, and forwarding to back's ingestion endpoint (front never writes to client DBs directly).
- `stripe-billing`: Sign-up trial subscription creation, plan picker / upgrade / downgrade flow, add-on management (recurring + one-time), overage cap configuration, Stripe webhook handler for `customer.subscription.*`, `invoice.paid` (creates credit buckets), `invoice.payment_failed` (dunning), `trial_will_end`, and multi-platform discount automation.
- `capability-resolution`: `GET /api/me/capabilities` resolver reading Stripe product metadata + `plan_limits`, 5-minute cache invalidated on `subscription_items` writes, and the `enforceCapability` middleware that returns 402 with structured upgrade hints.
- `trial-enforcement`: Trial duration (7 days OR 1 successful backup run), data caps (1K records / 5 tables / 100 attachments enforced by back at run-time), per-platform + per-Org + ever scoping, and trial-state flags on `subscription_items`.
- `in-app-notifications`: `notifications` table reader, dashboard notification panel, mark-as-read, and per-type / per-channel preference UI (`notification_channels`, `notification_preferences`).
- `front-email-notifications`: React Email + Mailgun templates and sends for front-owned categories (Magic Link, Password Reset, 2FA setup, Trial Welcome, Migration Welcome, Upgrade Confirmation, Payment Failed, Team Invitation).
- `migration-ux`: "Complete Your Migration" screen shown on first login when `has_migrated=false`, re-auth flows for Airtable Connection and storage destinations, completion that flips `has_migrated=true` and sends Migration Welcome email.
- `airtable-extension-embedding`: Embedded-context detection (URL param + `window.parent !== window`), `window.postMessage` framework with the wrapper, compact embedded layout, and first-use auth popup that does not break the iframe.
- `integrations-ui`: Inbound API token CRUD (plaintext shown once at creation, hash stored), display of the SQL REST endpoint URL + token, and Direct SQL connection string display (decrypted on-page request, never logged) for Business+.

### Modified Capabilities

None — this is the initial front implementation. No prior specs exist in `openspec/specs/`.

## Impact

- **New repos**: `baseout-web` (Cloudflare Pages + Workers) and `baseout-ui` (internal npm package).
- **External dependencies**: Cloudflare Pages + Workers, DigitalOcean PostgreSQL (master DB), better-auth, Stripe (Customers, Subscriptions, Webhooks, metered usage), Mailgun, PostHog (EU cloud), dub.co, Airtable OAuth + REST, storage-destination OAuth/IAM clients, React Email, React Flow, Floating UI, Shepherd.js, Playwright.
- **Cross-service contract** with back: writes `backup_runs` / `restore_runs` and POSTs to back's start endpoints, opens WebSockets to back DOs for live progress, forwards Inbound API writes to back, reads schema/changelog/restore-bundle endpoints from back, all using shared HMAC service tokens.
- **Master DB ownership**: front owns the Drizzle schema definition and migration workflow; publishes `@baseout/db-schema` for back. Front writes to `organizations`, `organization_members`, `connections`, `spaces`, `bases`, `subscriptions`, `subscription_items`, `backup_configurations`, `restore_runs` (insert), `storage_destinations`, `api_tokens`, `notification_channels`, `notification_preferences`, `health_score_rules`, `credit_buckets` (via Stripe webhook), `credit_addon_subscriptions`, `organization_billing_settings`. Front only reads `backup_runs`, `backup_run_bases`, `space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`.
- **Secrets**: Stripe (publishable + secret + webhook signing), Mailgun (front-scoped), better-auth secret, master encryption key (AES-256-GCM for OAuth tokens + Inbound API tokens at rest), Airtable OAuth client secret, storage-destination OAuth client secrets, service-to-back HMAC, PostHog project key, dub.co API key.
- **Operational**: Cloudflare Pages production + staging projects, Mailgun sending domain (`mail.baseout.com`) with DKIM/SPF/DMARC, Stripe products + prices wired per `../shared/Baseout_Features.md` §5.6, manual approval step on `main` for production migrations.

## 1. Phase 0 — Foundation

- [ ] 1.1 Create `baseout-ui` and `baseout-web` repos with README, Vitest, Drizzle, msw, basic dir layout
- [ ] 1.2 Wire GitHub Actions CI on both repos (Vitest on every PR; Docker PG + Miniflare D1 in CI)
- [ ] 1.3 Provision Cloudflare Pages projects (production + staging) for `baseout-web`
- [ ] 1.4 Author master DB Drizzle schema per `../shared/Master_DB_Schema.md`; commit initial migration
- [ ] 1.5 Publish `@baseout/db-schema` internal npm package (version 1.0.0)
- [ ] 1.6 Populate Cloudflare Secrets (Stripe, Mailgun, encryption key, OAuth secrets, DB connection string, service-to-back HMAC, PostHog, dub.co)
- [ ] 1.7 Scaffold `baseout-ui` package (Layout, Button, Input, Modal, Table, Form primitives, Tooltip wrapper via Floating UI)
- [ ] 1.8 Set up Mailgun account + sending domain `mail.baseout.com` (DKIM/SPF/DMARC)
- [ ] 1.9 Set up Stripe products + prices per `../shared/Baseout_Features.md` §5.6; register webhook endpoint
- [ ] 1.10 Set up PostHog (EU cloud) project key
- [ ] 1.11 Set up dub.co (replace Rewardful); migrate existing affiliate links

## 2. Phase 1 — Auth + Marketing + Pre-Reg Schema Viz

- [ ] 2.1 Install better-auth; integrate magic-link flow
- [ ] 2.2 Wire sign-up flow (email → magic link → account → Org + Stripe trial subscription)
- [ ] 2.3 Implement session management (better-auth); protect all app routes
- [ ] 2.4 Implement pre-registration session (temporary client-side ID; claim on registration)
- [ ] 2.5 Build landing page with primary CTA "Visualize your Airtable schema in 30 seconds"
- [ ] 2.6 Build pricing page reading from `plan_definitions` + `plan_credit_config` (no hardcoding)
- [ ] 2.7 Implement pre-registration Airtable OAuth flow + React Flow schema visualizer (metadata only)
- [ ] 2.8 Wire Stripe Customer creation on sign-up; persist `stripe_customer_id` on Org
- [ ] 2.9 Wire Trial subscription item ($0; `Baseout — Airtable — Trial`)
- [ ] 2.10 Implement Stripe webhook receiver `/api/webhooks/stripe` with signature verification + `stripe_events_processed` idempotency table

## 3. Phase 2 — Onboarding Wizard + Capability Resolver

- [ ] 3.1 Implement `GET /api/me/capabilities` reading Stripe metadata + `plan_limits`
- [ ] 3.2 Implement 5-minute capability cache keyed on `(organization_id, subscription_items.modified_at)`; invalidate on `subscription_items` write
- [ ] 3.3 Implement `enforceCapability(userId, capability)` middleware; 402 with structured upgrade hint on block
- [ ] 3.4 Implement enforcement of trial cap precedence over overage cap
- [ ] 3.5 Build wizard Step 1 (Connect Airtable; persist encrypted token in `connections`)
- [ ] 3.6 Build wizard Step 2 (Select Bases; multi-select + auto-add toggle; persist `bases` rows)
- [ ] 3.7 Build wizard Step 3 (Backup Frequency; capability-gated dropdown; persist `backup_configurations.frequency`)
- [ ] 3.8 Build wizard Step 4 (Storage Destination; R2 default; OAuth/IAM flows for each BYOS option)
- [ ] 3.9 Build wizard Step 5 (Confirm + Run First Backup; write `backup_runs`; call back's `/runs/{id}/start`)
- [ ] 3.10 Implement wizard resume from `spaces.onboarding_step`; lock dashboard until first backup completes
- [ ] 3.11 Implement Google Drive OAuth (folder picker)
- [ ] 3.12 Implement Dropbox OAuth
- [ ] 3.13 Implement Box OAuth
- [ ] 3.14 Implement OneDrive OAuth (folder picker)
- [ ] 3.15 Implement S3 IAM access-key form (Growth+; with bucket validation)
- [ ] 3.16 Implement Frame.io OAuth (Growth+)
- [ ] 3.17 Implement Custom/BYOS generic config form (Pro+)

## 4. Phase 3 — Dashboard + Live Progress

- [ ] 4.1 Implement Space selector (last-viewed persisted per user)
- [ ] 4.2 Build backup status widget (WebSocket to back DO; fallback to last `backup_runs`)
- [ ] 4.3 Build backup history list (`backup_runs` query; pagination)
- [ ] 4.4 Build storage usage card (R2 + DB usage from cached `space_databases.size`)
- [ ] 4.5 Build notifications panel (`notifications` table reader)
- [ ] 4.6 Build health score card (per-Base; reads from client DB via back read endpoint)
- [ ] 4.7 Implement WebSocket client to `wss://{BACKUP_ENGINE_URL}/spaces/{id}/progress`
- [ ] 4.8 Implement progress component rendering events per cross-service contract
- [ ] 4.9 Implement WS reconnection handling with backoff and resume from last run state
- [ ] 4.10 Build Restore UI snapshot picker (timeline of `backup_runs` per Space)
- [ ] 4.11 Build Restore UI scope picker (base / table / point-in-time)
- [ ] 4.12 Build Restore UI destination chooser (new base / new table in existing base)
- [ ] 4.13 Implement Restore submit (write `restore_runs`; POST to back's `/restores/{id}/start`)
- [ ] 4.14 Implement Restore status updates (WebSocket or poll on `restore_runs`)
- [ ] 4.15 Render verification result (Growth+) from `restore_runs.verification_status`
- [ ] 4.16 Render Community Restore Tooling bundle (Pro+) from back's `/spaces/{id}/restore-bundle/{run_id}`

## 5. Phase 4 — Schema, Data, Automations, Interfaces, AI Documentation UI

- [ ] 5.1 Build Schema visualization (React Flow graph; field-type filtering)
- [ ] 5.2 Build Schema changelog (renders human-readable diffs from back endpoint)
- [ ] 5.3 Build health score display + rule configuration UI (Pro+)
- [ ] 5.4 Build diagram export (PNG/SVG/PDF/embed widget per tier)
- [ ] 5.5 Build Data view (per-table/per-base record metrics; Growth+)
- [ ] 5.6 Build Data changelog (Growth+)
- [ ] 5.7 Build growth trend charts (Recharts; Growth+)
- [ ] 5.8 Build Automations list view (Growth+) + manual entry form (forwards to back's `/inbound/automations`)
- [ ] 5.9 Build Interfaces list view (Growth+) + manual entry form (forwards to back's `/inbound/interfaces`)
- [ ] 5.10 Build "Generate description" button on schema fields/tables (Pro+)
- [ ] 5.11 Implement synchronous Cloudflare AI call from a front endpoint
- [ ] 5.12 Persist generated text to schema description via back's write path
- [ ] 5.13 Debit 10 credits per generation via `credit_transactions`

## 6. Phase 5 — Inbound API + Stripe Webhook Hardening + Billing UI

- [ ] 6.1 Build Inbound API token CRUD UI (`api_tokens`; plaintext shown once at creation; SHA-256 hash stored)
- [ ] 6.2 Implement `/api/v1/inbound/automations` (Zod validation + forward to back)
- [ ] 6.3 Implement `/api/v1/inbound/interfaces`
- [ ] 6.4 Implement `/api/v1/inbound/synced-tables`
- [ ] 6.5 Implement `/api/v1/inbound/custom-metadata`
- [ ] 6.6 Implement tier-based monthly rate limiting (10K Growth, 50K Pro, 200K Business, Unlimited Enterprise)
- [ ] 6.7 Implement credit consumption (1 credit per 100 calls)
- [ ] 6.8 Author OpenAPI 3 spec; host at `docs.baseout.com`
- [ ] 6.9 Handle `customer.subscription.created` (persist `subscriptions` + trial item)
- [ ] 6.10 Handle `customer.subscription.updated` (update `subscription_items` for tier swap / cancel)
- [ ] 6.11 Handle `customer.subscription.deleted` (mark cancelled)
- [ ] 6.12 Handle `invoice.paid` (open `plan_monthly` + `addon_monthly` credit buckets per `../shared/Pricing_Credit_System.md` §8.5)
- [ ] 6.13 Handle `invoice.payment_failed` (mark `past_due`; trigger Payment Failed dunning email)
- [ ] 6.14 Handle `customer.subscription.trial_will_end` (Trial Expiry Warning email)
- [ ] 6.15 Implement multi-platform discount automation (apply Stripe coupon when 2nd platform item added)
- [ ] 6.16 Build Plan picker (reads `plan_definitions`; hides hidden plans)
- [ ] 6.17 Build upgrade flow (Stripe Elements; subscription item swap)
- [ ] 6.18 Build add-on management (recurring credit add-ons + one-time credit packs)
- [ ] 6.19 Build overage cap configuration UI (`organization_billing_settings`)
- [ ] 6.20 Build invoice history (Stripe API + cached `invoices` if needed)

## 7. Phase 6 — Email Templates + In-App Notifications

- [ ] 7.1 Build React Email Magic Link template
- [ ] 7.2 Build React Email Password Reset template
- [ ] 7.3 Build React Email 2FA setup confirmation template
- [ ] 7.4 Build React Email Trial Welcome template
- [ ] 7.5 Build React Email Migration Welcome template
- [ ] 7.6 Build React Email Upgrade Confirmation template
- [ ] 7.7 Build React Email Payment Failed (dunning) template
- [ ] 7.8 Build React Email Team Invitation template
- [ ] 7.9 Wire Mailgun SDK with front-scoped API key + sending domain `mail.baseout.com`
- [ ] 7.10 Build notifications panel (per-Org, sorted by recency)
- [ ] 7.11 Implement mark-as-read per notification (per-user)
- [ ] 7.12 Build per-type, per-channel preference UI (`notification_channels`, `notification_preferences`)

## 8. Phase 7 — On2Air Migration UX

- [ ] 8.1 Build "Complete Your Migration" screen (shown when `has_migrated=false`)
- [ ] 8.2 Implement Airtable re-auth flow (replace legacy connection with new encrypted tokens)
- [ ] 8.3 Implement per-storage-destination re-auth flow
- [ ] 8.4 Persist `has_migrated=true` on completion; redirect to dashboard
- [ ] 8.5 Trigger Migration Welcome email on completion

## 9. Phase 8 — Airtable Extension Embedding

- [ ] 9.1 Implement embedded-context detection (URL param + `window.parent !== window`)
- [ ] 9.2 Implement `window.postMessage` framework (receive base/table/view context from wrapper)
- [ ] 9.3 Build compact embedded layout (single-base focus, smaller sidebar)
- [ ] 9.4 Implement first-use auth popup (does not break iframe)

## 10. Phase 9 — Mobile, Tooltips, Guided Tours

- [ ] 10.1 Mobile responsive audit on all dashboard surfaces
- [ ] 10.2 Schema viz mobile mode (simplified scrollable view)
- [ ] 10.3 Wire Floating UI tooltips on major UI elements
- [ ] 10.4 Wire Shepherd.js guided tours (onboarding, schema viz, restore, Space settings)

## 11. Phase 10 — Pre-Launch Hardening

- [ ] 11.1 Add email + password auth (better-auth password strategy)
- [ ] 11.2 Add 2FA (TOTP) (better-auth 2FA plugin)
- [ ] 11.3 Add SSO (SAML) (better-auth SSO plugin; Enterprise only)
- [ ] 11.4 Implement E2E Playwright suite covering critical flows from Front PRD §18
- [ ] 11.5 Run security review (secrets audit; encryption validation; auth flow review)
- [ ] 11.6 Wire PostHog instrumentation (web + product analytics; session replay; feature flags)
- [ ] 11.7 Run performance audit (page load, time-to-interactive)
- [ ] 11.8 Run accessibility audit (WCAG AA target)

## 12. Definition of Done — Front V1 Launch

- [ ] 12.1 Sign-up + magic link + password + 2FA all functional
- [ ] 12.2 Pre-registration schema visualization works without auth
- [ ] 12.3 Onboarding wizard completes end-to-end and triggers a real backup
- [ ] 12.4 Dashboard shows live progress and backup history
- [ ] 12.5 Restore UI submits restore jobs and shows results
- [ ] 12.6 Schema visualization, changelog, health score render for Launch+
- [ ] 12.7 Inbound API: token CRUD, all endpoints, rate limiting, credit consumption functional
- [ ] 12.8 Stripe webhook handles all V1 events idempotently
- [ ] 12.9 Billing UI: plan picker, upgrade, add-ons, overage cap functional
- [ ] 12.10 All front-owned React Email templates send via Mailgun
- [ ] 12.11 In-app notifications work
- [ ] 12.12 On2Air migration UX works for migrated users
- [ ] 12.13 Airtable extension embedding works in compact mode
- [ ] 12.14 Mobile responsiveness validated on all dashboard surfaces
- [ ] 12.15 PostHog + dub.co instrumented
- [ ] 12.16 Playwright E2E suite passes
- [ ] 12.17 Security review complete

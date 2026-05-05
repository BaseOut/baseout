## Context

Front is the customer-touching surface of Baseout: marketing pages, the customer dashboard, all `/api/*` web endpoints, the master DB schema (canonical source of truth, exported as `@baseout/db-schema` for back to consume), and the front-owned email categories. The back PRD's contract assumes a stable web app that writes the run/restore tables and forwards inbound API calls; everything customer-visible must respond within 1–2 seconds inside an Astro page. The split between front and back has already been negotiated (see Front_PRD.md §1, §17 and Back_PRD.md §16); this design captures the rationale and the open trade-offs.

Stakeholders: customers (every persona — admin, developer, AI agent), back team (consumers of the schema package and recipients of forwarded Inbound API calls), product (capability matrix), revenue/billing (Stripe webhook correctness), legal/compliance (encryption + GDPR sending domain region).

Constraints carried in from product:
- **Master DB ownership lives in front** — the Drizzle schema is canonical and back imports rather than redefines.
- **Auth is exclusively front** — back never logs a user in.
- **Airtable OAuth is never a login method** — only a Connection auth flow.
- **Inbound API forwards to back** — front never writes to client DBs directly.
- **Tier-gating reads from a single resolver** — no hardcoded `if tier==='X'` paths.
- **Email is owned by the side that detects the trigger** (no central dispatch endpoint).

## Goals / Non-Goals

**Goals:**
- A visitor can OAuth Airtable and see their schema in <30 seconds without signing up.
- A signed-up user can complete onboarding (5 steps) and trigger their first backup in one session.
- The dashboard surfaces live progress within 200 ms of a back-emitted event.
- Capability resolution returns under 50 ms (cached) and reflects Stripe subscription changes within seconds of the webhook.
- Stripe webhooks are processed idempotently with replay protection.
- Inbound API calls are validated, rate-limited, and forwarded to back in a single request lifecycle.
- The mobile dashboard is fully usable for backup status, notifications, and history.
- The migration UX gracefully steps an On2Air user through Airtable + storage re-auth before the dashboard is reachable.

**Non-Goals:**
- Native mobile apps (V1 is web-only).
- AI MCP / RAG / chatbot / vector DB (V2).
- Governance UI logic (V2 — placeholder only).
- Custom analytics reports / dashboards (V1 placeholder only).
- Per-Space notification channel configuration (V1 is Org-level only — see F5).
- Persisted pre-registration sessions across browser close (V1 is ephemeral — see F1).
- Multi-platform UI rendering for any non-Airtable platform (V2 — placeholder nav only).

## Decisions

### Astro SSR + Cloudflare Pages + better-auth
Astro SSR on Cloudflare Pages gives us fast page loads, server-side rendering for SEO on marketing pages, and a single deploy target for both the public site and the dashboard. better-auth is the auth provider because it natively supports magic link, password, 2FA, and SSO with a clean plugin architecture, and it works well with Workers. Trade: better-auth is younger than NextAuth; we accept the maturity risk in exchange for the cleaner Cloudflare runtime story.

### `@baseout/db-schema` as an internal npm package (vs. monorepo path import)
Front publishes the Drizzle schema as an internal npm package consumed by back at a pinned version. This keeps repos independent and lets each side update on its own cadence. Resolved (F2). Alternative considered: monorepo path import. Rejected because back has its own deploy cadence and we want explicit version pinning for migrations.

### Inbound API forwards to back (vs. write directly via SQL REST)
Front's Inbound API authenticates, rate-limits, validates, and POSTs to a back ingestion endpoint. Front does NOT write to client DBs directly. This keeps a single owner (back) of client-DB writes, even though the public-facing API lives on front. Resolved (F3).

### Capability cache TTL: 5 minutes with subscription-write invalidation
5-minute TTL keyed on `(organization_id, subscription_items.modified_at)`. Invalidate on any `subscription_items` write so a Stripe upgrade reflects immediately. Resolved (F4). Alternative considered: shorter TTL or always-fresh. Rejected because the cache hit rate dominates request volume.

### Pre-registration session: ephemeral-only for V1
No `pre_registration_sessions` table; the OAuth token lives only in browser session/local storage. Avoids storing OAuth tokens for unauthenticated users. Resolved (F1). Revisit if conversion data shows users dropping mid-flow.

### Notification channels: Org-level for V1
`notification_channels` is keyed by Org, not Space. Resolved (F5). Per-Space configuration deferred unless user demand emerges.

### Onboarding wizard state: integer step
`spaces.onboarding_step` is an integer; rich state is re-derived from existing tables (`connections`, `bases`, `backup_configurations`, `storage_destinations`). Resolved (F6).

### Storage destination: one per Space (not split static vs. dynamic)
One `storage_destinations.is_default` per Space. Dynamic backups write to the provisioned client DB, not a destination. Resolved (F7).

### Trial cap precedence over overage cap
When both caps would fire, the UX shows "trial limit hit, upgrade to continue" rather than the overage hint. Resolved (F8).

### Multi-platform nav placeholder
Front renders a multi-platform-aware navigation now, with a single Airtable platform in V1. Avoids a nav redesign at V2 launch. Resolved (F9).

### React Email + Mailgun, EU sending domain consideration
Templates use React Email; sending via Mailgun on `mail.baseout.com`. Region (EU vs. US) decided per GDPR consideration before launch.

### Two Mailgun keys (one per side, per environment)
Front and back each hold their own Mailgun API key. No internal email-dispatch endpoint exists. Both call Mailgun directly. Originally the plan was for front to be the only Mailgun caller; revised because back has its own operational email categories that benefit from being owned by the side detecting the trigger.

## Risks / Trade-offs

- **[Risk] better-auth maturity** → Pin a known-good version; integration spike before Phase 0 closes; have a fallback plan to swap to NextAuth or Auth.js if blockers emerge.
- **[Risk] Capability cache staleness post-upgrade** → Invalidate aggressively on `subscription_items` writes; add a manual "refresh capabilities" flow for emergencies.
- **[Risk] Stripe webhook ordering** → Use `stripe_events_processed` + idempotency; treat each event as independent; don't rely on ordering.
- **[Risk] Live-progress WebSocket flakiness on mobile networks** → Auto-reconnect with backoff; resume from last received state; degrade gracefully to polling `backup_runs.status` if WS is unreachable.
- **[Risk] Embedded mode auth popup blocked by browsers** → Document the user gesture requirement; provide a clear "Sign in" CTA inside the iframe before triggering the popup.
- **[Trade-off] Ephemeral pre-reg session loses OAuth on browser close** → Acceptable for V1; the privacy benefit (no stored tokens for non-users) outweighs the conversion friction.
- **[Trade-off] Org-level notification channels** → Limits flexibility for orgs with multiple Spaces; revisit if user demand emerges.
- **[Trade-off] Inbound API extra hop (front → back)** → Adds latency; acceptable because client-DB ownership clarity is more important than API-call latency for batch operations.

## Migration Plan

### Build sequence (mirrors `Front_Implementation_Plan.md` phases)

1. **Phase 0 — Foundation**: Repos, CI/CD, master DB schema (Drizzle) + initial migration + `@baseout/db-schema` publish, Cloudflare Pages projects, Cloudflare Secrets, `baseout-ui` scaffold, Mailgun/Stripe/PostHog/dub.co accounts.
2. **Phase 1 — Auth + Marketing + Pre-Reg Schema Viz**: better-auth (magic link), public landing/pricing pages, pre-registration schema visualization, Stripe customer creation on sign-up, Stripe webhook receiver scaffolding.
3. **Phase 2 — Onboarding Wizard + Capability Resolver**: capability resolver + cache + middleware, 5-step wizard, storage destination OAuth flows. **Cross-side checkpoint:** Step 5 calls back's `/runs/{id}/start`.
4. **Phase 3 — Dashboard + Live Progress**: dashboard layout + cards, WebSocket live-progress client, Restore UI submission contract.
5. **Phase 4 — Schema, Data, Automations, Interfaces, AI Documentation UI**: tier-appropriate UIs reading from back's schema/changelog endpoints + client DB.
6. **Phase 5 — Inbound API + Stripe Webhook Hardening**: token CRUD, all `/api/v1/inbound/*` endpoints with validation/rate-limit/credit, full Stripe lifecycle (all events, dunning, multi-platform discount), billing UI.
7. **Phase 6 — Email Templates + In-App Notifications**: front-owned React Email templates, notifications panel, channel preferences UI.
8. **Phase 7 — On2Air Migration UX**: "Complete Your Migration" screen, re-auth flows, `has_migrated=true` flip, Migration Welcome.
9. **Phase 8 — Airtable Extension Embedding**: detection, postMessage framework, compact layout, popup auth.
10. **Phase 9 — Mobile, Tooltips, Guided Tours**: mobile audit, schema viz mobile mode, Floating UI tooltips, Shepherd.js tours.
11. **Phase 10 — Pre-Launch Hardening**: email + password, 2FA, SSO, E2E Playwright suite, security review, PostHog, performance + accessibility audits.

### Migration of existing customers
On2Air migration UX (Phase 7) consumes state populated by back's one-shot On2Air migration script. Front does not run any data migration itself.

### Rollback strategy
- DB schema migrations require a manual production approval step on `main` merge; failed migrations roll back via Drizzle's revert.
- Stripe webhook handler bugs: `stripe_events_processed` allows re-processing fixed handlers without duplicate side effects.
- Pages deploys: Cloudflare Pages rollback to previous deployment in <2 minutes.
- Capability cache poisoning: a manual flush endpoint clears Org-keyed cache entries.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| F1 | Pre-registration session: ephemeral or persisted? | **Resolved (V1)**: ephemeral-only. |
| F2 | Schema-package distribution: workspace path import vs. published internal npm? | **Resolved**: `@baseout/db-schema` internal npm. |
| F3 | Inbound API write path: front-direct or POST to back? | **Resolved**: POST to back. |
| F4 | Capability cache TTL: 5 minutes or shorter? | **Resolved**: 5 minutes; invalidate on `subscription_items` write. |
| F5 | Notification channels: org-level or space-level? | **Resolved (V1)**: org-level. |
| F6 | Onboarding wizard rich state | **Resolved**: integer step + re-derive. |
| F7 | Storage destination default | **Resolved**: one per Space (dynamic writes to provisioned DB). |
| F8 | Trial cap interaction with overage cap | **Resolved**: trial cap takes precedence. |
| F9 | Multi-platform Space (V2) — render placeholder nav now? | **Resolved**: yes; prevents V2 redesign. |
| F10 | Mailgun region (EU vs US) | Decide pre-launch per GDPR consideration. |
| F11 | Google OAuth as a login method | Evaluate pre-launch; default `no` if no clear win. |

# Tasks — baseout-web-billing-portal

≤ 20 minutes.

## 1 — Endpoint

- [ ] 1.1 Create [apps/web/src/pages/api/billing/portal.ts](../../../apps/web/src/pages/api/billing/portal.ts):
  - `POST` handler.
  - 401 if `locals.user` is null.
  - 403 if `locals.account.organization` is null.
  - Resolves `stripe_customer_id` from `organizations` for the active org.
  - 409 with code `'no_customer'` if `stripe_customer_id` is null (signup didn't complete or trial customer creation never ran).
  - Calls `stripe.billingPortal.sessions.create({ customer, return_url: '${origin}/settings' })`.
  - Returns `200 { url }`.
  - In dev when Stripe is not configured (`resolveStripeEnv()` returns `skip-dev`), returns 503 with `{ ok: false, code: 'stripe_disabled', error: 'Stripe is not configured in this dev environment' }` so the Settings UI can render a clear message.

## 2 — Verification

- [ ] 2.1 `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] 2.2 `pnpm --filter @baseout/web build` — clean.
- [ ] 2.3 No `console.*` or `debugger` (CLAUDE.md §3.5).

## Out of scope (deferred to follow-up changes)

- Settings UI button — `baseout-web-settings-billing-cta` (after PR #1 merges).
- Stripe webhook receiver, idempotency table, dunning logic, plan upgrade/downgrade, add-ons, credit packs — `baseout-web-stripe-full`.
- Customer creation outside the trial flow — `ensureStripeTrialSubscription` is the canonical path; this endpoint never creates customers.

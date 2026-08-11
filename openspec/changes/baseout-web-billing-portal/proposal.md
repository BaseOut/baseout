## Why

The `/settings` Plan card (introduced in [`baseout-web-stability-pass-1`](../baseout-web-stability-pass-1/), PR #1) needs a "Manage subscription" call-to-action so trialing users can self-serve onto a paid plan and paying users can update payment methods. Stripe's hosted Customer Portal is the standard way to do this — single API call to create a session, return its URL, redirect the browser.

Today there's no endpoint to create the portal session. This change ships the endpoint so the Settings UI (in PR #1 + a follow-up wiring change) has something to call.

This is the API half of `baseout-web/tasks.md` §3.4 (`baseout-web-stripe-full`), pulled forward as a tiny isolated piece because:
- The Stripe client + customer creation already exists (`lib/stripe.ts`).
- The portal session API call is one line of Stripe SDK.
- The rest of `baseout-web-stripe-full` (webhook receiver, idempotency table, dunning, plan upgrade/downgrade, add-ons, credit packs, overage caps) is much larger and stays deferred.

## What Changes

- **Add** [apps/web/src/pages/api/billing/portal.ts](../../../apps/web/src/pages/api/billing/portal.ts):
  - `POST` handler.
  - Requires session auth (401 if `locals.user` is null).
  - Resolves the active org's `stripe_customer_id` from `organizations` table.
  - 409 if no Stripe customer (org pre-trial state — `ensureStripeTrialSubscription` should have created one at signup; if it's missing, surface a clear error rather than create one in this path).
  - Calls `stripe.billingPortal.sessions.create({ customer, return_url })` with `return_url` set to `${origin}/settings`.
  - Returns `200 { url: '<stripe-portal-url>' }` — caller redirects via `window.location.href`.
- **Reuse** [apps/web/src/lib/stripe.ts](../../../apps/web/src/lib/stripe.ts) — `resolveStripeEnv()` for env handling, `createStripeClient()` for the SDK client. Mirrors the pattern in [apps/web/src/pages/api/onboarding/complete.ts](../../../apps/web/src/pages/api/onboarding/complete.ts).
- **No DB writes**. Read-only on `organizations.stripe_customer_id`.

## Capabilities

### New Capabilities

- `web-billing-portal` — `POST /api/billing/portal` returns a Stripe Customer Portal session URL for the active org. Spec: [specs/web-billing-portal/spec.md](./specs/web-billing-portal/spec.md).

### Modified Capabilities

None.

## Impact

- New file: API route only — no UI changes today (the Settings card it serves lives in PR #1's settings.astro). A follow-up change `baseout-web-settings-billing-cta` wires the button once PR #1 merges.
- No DB / migration. Reads `organizations.stripe_customer_id` (pre-existing column).
- New env var dependency: `STRIPE_SECRET_KEY` (already required by onboarding flow).

## Reversibility

Fully reversible: deleting the endpoint file restores prior state. No data migration. No external state created beyond the (cheap, idempotent) Stripe portal sessions, which expire on their own.

## Context

Stripe Customer Portal is hosted by Stripe; we just create a session and redirect the user. No persistent state on our side. The only complexity is mapping the active org → `stripe_customer_id` and handling the dev-without-Stripe case.

## Goals

- One endpoint: `POST /api/billing/portal` → returns a portal URL.
- Use the existing Stripe-env resolution pattern so dev escape-hatch behavior matches the onboarding flow.

## Non-Goals

- Webhook receiver / subscription state changes — `baseout-web-stripe-full`.
- Customer creation in this path — `ensureStripeTrialSubscription` is canonical.
- UI wiring — separate follow-up after PR #1 merges.

## Decisions

### D1 — Customer creation NEVER happens here

If the org's `stripe_customer_id` is null, return `409 { code: 'no_customer' }`. The portal endpoint is a read-only mapping; customer creation is the onboarding flow's responsibility.

**Why:** Single source-of-truth for customer creation. Avoids race conditions where two parallel `/api/billing/portal` calls could create duplicate customers.

### D2 — Return JSON `{ url }`, not a 302

The endpoint returns the URL in the body and lets the client navigate. Simpler caller pattern (one fetch + one `window.location.href = url`); also avoids CORS complications that 302-from-fetch sometimes hits.

### D3 — `return_url` is `${origin}/settings`

When Stripe redirects the user back, they land on the same Settings page. `origin` is computed from the request URL (works in dev + prod without env-var coupling).

### D4 — Dev escape: 503 `stripe_disabled`

In dev environments without `STRIPE_SECRET_KEY`, the existing pattern is `resolveStripeEnv({ isDev: true }) → 'skip-dev'`. This endpoint mirrors it: returns `503 { code: 'stripe_disabled' }` so the Settings UI can render a clear "Stripe is not configured locally" message rather than a vague 500.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | Stripe API rate-limit during portal session creation | Low | Stripe portal session creation is rate-limited at 100/sec; far above our traffic. No retry logic needed. |
| R2 | `stripe_customer_id` exists in DB but Stripe deleted the customer | Low | Stripe returns a 404; this endpoint returns `502 { code: 'upstream_error' }`. Out-of-band reconciliation handled by `baseout-web-stripe-full`. |

## Verification

```bash
pnpm --filter @baseout/web typecheck   # 0 errors
pnpm --filter @baseout/web build        # clean

# Authenticated request returns a Stripe URL
curl -i -X POST https://localhost:4331/api/billing/portal \
  -b 'better-auth.session_token=<valid>'
# Expect 200 { url: 'https://billing.stripe.com/p/session/<id>' }

# Unauthenticated request → 401
curl -i -X POST https://localhost:4331/api/billing/portal
# Expect 401 { error: 'Not authenticated' }
```

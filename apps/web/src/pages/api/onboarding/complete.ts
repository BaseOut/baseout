import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  markTermsAccepted,
  OnboardingError,
  persistStripeIds,
  provisionOnboarding,
  validateOnboardingInput,
} from '../../../lib/onboarding/complete'
import {
  createStripeClient,
  ensureStripeTrialSubscription,
  resolveStripeEnv,
} from '../../../lib/stripe'
import {
  extractSessionTokenCookie,
  invalidateSessionCache,
} from '../../../lib/session-cache'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  // Middleware caches { user, session, account } per session token for 30s.
  // After we flip termsAcceptedAt / insert the Org + Space below, the very
  // next page load (the client's redirect to `/`) would otherwise hit the
  // stale cache and bounce the user back to /welcome. Capture the token now
  // and invalidate at the end of every path that mutates or depends on
  // post-onboarding state.
  const sessionToken = extractSessionTokenCookie(
    request.headers.get('cookie') ?? '',
  )

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  let validated
  try {
    validated = validateOnboardingInput(body)
  } catch (err) {
    if (err instanceof OnboardingError && err.detail.kind === 'invalid') {
      return jsonResponse({ error: err.detail.message, field: err.detail.field }, 400)
    }
    throw err
  }

  // Runtime flag from .dev.vars (local) or wrangler vars. MUST NOT be set in
  // production — .dev.vars is gitignored and wrangler.jsonc does not declare
  // DEV_SKIP_STRIPE, so the only way it can ever be '1' is a developer's
  // local machine. An `import.meta.env` gate does not work here: `npm run
  // wrangler` does `astro build && wrangler dev --remote`, which bakes
  // DEV=false into the bundle, so the skip branch would be dead locally.
  const workerEnv = env as unknown as Record<string, string | undefined>
  const stripeResolution = resolveStripeEnv(workerEnv, {
    isDev: workerEnv.DEV_SKIP_STRIPE === '1',
  })

  if (stripeResolution.kind === 'missing') {
    return jsonResponse(
      { error: 'Billing is not configured. Please try again shortly.' },
      503,
    )
  }

  let snapshot
  try {
    snapshot = await provisionOnboarding(locals.db, locals.user.id, validated)
  } catch (err) {
    if (err instanceof OnboardingError) {
      if (err.detail.kind === 'already_onboarded') {
        // DB is already consistent; drop any stale cached entry so the
        // upcoming `/` navigation sees the real post-onboarding state.
        invalidateSessionCache(sessionToken)
        return jsonResponse({ ok: true, alreadyOnboarded: true }, 200)
      }
      if (err.detail.kind === 'user_not_found') {
        return jsonResponse({ error: 'User not found' }, 404)
      }
    }
    throw err
  }

  if (stripeResolution.kind === 'configured') {
    const stripe = createStripeClient(stripeResolution.env.secretKey)
    let stripeResult
    try {
      stripeResult = await ensureStripeTrialSubscription({
        stripe,
        organizationId: snapshot.organizationId,
        orgName: snapshot.orgName,
        email: snapshot.userEmail,
        trialPriceId: stripeResolution.env.trialPriceId,
        existingCustomerId: snapshot.stripeCustomerId,
        existingSubscriptionId: snapshot.stripeSubscriptionId,
      })
    } catch {
      // DB rows persist; termsAcceptedAt still NULL so the middleware keeps
      // the user on /welcome. Idempotency keys ensure the next attempt is safe.
      return jsonResponse(
        { error: 'Setup hiccup — please try again.' },
        500,
      )
    }

    await persistStripeIds(
      locals.db,
      snapshot.organizationId,
      stripeResult.customerId,
      stripeResult.subscriptionId,
    )
  }
  // TODO(stripe-dev-setup): once Stripe test-mode is provisioned, drop the
  // dev skip:
  //   1. Stripe Dashboard (test mode) → Developers → API keys → copy
  //      Secret key (sk_test_...).
  //   2. Stripe Dashboard (test mode) → Products → create a recurring Price
  //      ($0/mo is fine — it seeds the trial); copy the price id (price_...).
  //   3. Add to .dev.vars:
  //        STRIPE_SECRET_KEY=sk_test_...
  //        STRIPE_TRIAL_PRICE_ID=price_...
  //      …and remove DEV_SKIP_STRIPE=1.
  //   4. Restart the dev server. resolveStripeEnv() will return `configured`
  //      and the real ensureStripeTrialSubscription() path runs end-to-end.
  // When every dev environment has real Stripe test keys, this handler can
  // drop the `skip-dev` branch and collapse back to missing/configured only.
  // stripeResolution.kind === 'skip-dev': DB rows (Org, Space, membership,
  // prefs) persisted above; no Stripe customer/subscription created; we still
  // mark terms accepted so middleware lets the user out of /welcome.

  await markTermsAccepted(locals.db, locals.user.id)
  invalidateSessionCache(sessionToken)

  return jsonResponse({ ok: true }, 200)
}

/**
 * POST /api/billing/portal — creates a Stripe Customer Portal session for the
 * active organization and returns its hosted URL.
 *
 * Spec: openspec/changes/baseout-web-billing-portal/specs/web-billing-portal/spec.md
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { organizations } from '../../../db/schema'
import { createStripeClient, resolveStripeEnv } from '../../../lib/stripe'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const POST: APIRoute = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, 401)
  }
  const orgId = locals.account?.organization?.id
  if (!orgId) {
    return json({ error: 'No active organization' }, 403)
  }

  const stripeEnv = resolveStripeEnv(
    env as unknown as Record<string, string | undefined>,
    { isDev: import.meta.env.DEV },
  )
  if (stripeEnv.kind === 'skip-dev') {
    return json(
      {
        ok: false,
        code: 'stripe_disabled',
        error: 'Stripe is not configured in this dev environment',
      },
      503,
    )
  }
  if (stripeEnv.kind === 'missing') {
    return json(
      {
        ok: false,
        code: 'stripe_disabled',
        error: `${stripeEnv.reason} is not set`,
      },
      503,
    )
  }

  const [org] = await locals.db
    .select({ stripeCustomerId: organizations.stripeCustomerId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org?.stripeCustomerId) {
    return json(
      {
        ok: false,
        code: 'no_customer',
        error: 'No Stripe customer for this organization',
      },
      409,
    )
  }

  const stripe = createStripeClient(stripeEnv.env.secretKey)
  const returnUrl = `${url.origin}/settings`

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    })
    return json({ url: session.url }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    return json(
      {
        ok: false,
        code: 'upstream_error',
        error: message,
      },
      502,
    )
  }
}

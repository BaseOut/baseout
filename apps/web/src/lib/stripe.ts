import Stripe from 'stripe'

export interface StripeEnv {
  secretKey: string
  trialPriceId: string
}

export class StripeConfigError extends Error {
  constructor(public missing: 'STRIPE_SECRET_KEY' | 'STRIPE_TRIAL_PRICE_ID') {
    super(`${missing} is not set`)
  }
}

export function readStripeEnv(env: Record<string, string | undefined>): StripeEnv {
  if (!env.STRIPE_SECRET_KEY) throw new StripeConfigError('STRIPE_SECRET_KEY')
  if (!env.STRIPE_TRIAL_PRICE_ID) throw new StripeConfigError('STRIPE_TRIAL_PRICE_ID')
  return { secretKey: env.STRIPE_SECRET_KEY, trialPriceId: env.STRIPE_TRIAL_PRICE_ID }
}

export type StripeEnvResolution =
  | { kind: 'configured'; env: StripeEnv }
  | { kind: 'skip-dev'; reason: StripeConfigError['missing'] }
  | { kind: 'missing'; reason: StripeConfigError['missing'] }

// Wraps readStripeEnv so the handler can branch on three outcomes:
//   - configured: run the Stripe trial flow.
//   - missing  : fail closed in prod (503 surfaced by the caller).
//   - skip-dev : a local dev escape hatch so onboarding can complete without
//                real Stripe test keys. Callers MUST gate isDev on a
//                build-time constant (e.g. import.meta.env.DEV) — never on a
//                runtime-mutable signal — so prod bundles cannot reach this
//                branch.
export function resolveStripeEnv(
  env: Record<string, string | undefined>,
  opts: { isDev: boolean },
): StripeEnvResolution {
  try {
    return { kind: 'configured', env: readStripeEnv(env) }
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return opts.isDev
        ? { kind: 'skip-dev', reason: err.missing }
        : { kind: 'missing', reason: err.missing }
    }
    throw err
  }
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export interface EnsureTrialSubscriptionInput {
  stripe: Stripe
  organizationId: string
  orgName: string
  email: string
  trialPriceId: string
  existingCustomerId: string | null
  existingSubscriptionId: string | null
}

export interface EnsureTrialSubscriptionResult {
  customerId: string
  subscriptionId: string
}

export const TRIAL_PERIOD_DAYS = 7

export async function ensureStripeTrialSubscription(
  input: EnsureTrialSubscriptionInput,
): Promise<EnsureTrialSubscriptionResult> {
  const customerId =
    input.existingCustomerId ??
    (
      await input.stripe.customers.create(
        {
          name: input.orgName,
          email: input.email,
          metadata: { organizationId: input.organizationId },
        },
        { idempotencyKey: `org-${input.organizationId}:customer` },
      )
    ).id

  if (input.existingSubscriptionId) {
    return { customerId, subscriptionId: input.existingSubscriptionId }
  }

  const trialEnd = Math.floor(Date.now() / 1000) + TRIAL_PERIOD_DAYS * 86400

  const subscription = await input.stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: input.trialPriceId }],
      trial_end: trialEnd,
      metadata: { organizationId: input.organizationId },
    },
    { idempotencyKey: `org-${input.organizationId}:sub:trial` },
  )

  return { customerId, subscriptionId: subscription.id }
}

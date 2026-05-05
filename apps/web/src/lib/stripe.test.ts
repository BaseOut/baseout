import { describe, it, expect, vi } from 'vitest'
import type Stripe from 'stripe'
import {
  ensureStripeTrialSubscription,
  readStripeEnv,
  resolveStripeEnv,
  StripeConfigError,
  TRIAL_PERIOD_DAYS,
} from './stripe'

describe('readStripeEnv', () => {
  it('returns both keys when present', () => {
    expect(
      readStripeEnv({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_TRIAL_PRICE_ID: 'price_x' }),
    ).toEqual({ secretKey: 'sk_test_x', trialPriceId: 'price_x' })
  })

  it('throws StripeConfigError naming the missing key', () => {
    expect(() => readStripeEnv({ STRIPE_TRIAL_PRICE_ID: 'price_x' })).toThrow(
      StripeConfigError,
    )
    expect(() =>
      readStripeEnv({ STRIPE_SECRET_KEY: 'sk', STRIPE_TRIAL_PRICE_ID: undefined }),
    ).toThrow(/STRIPE_TRIAL_PRICE_ID/)
  })
})

describe('resolveStripeEnv', () => {
  const ok = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_TRIAL_PRICE_ID: 'price_x' }

  it('returns configured when both keys are set, regardless of isDev', () => {
    expect(resolveStripeEnv(ok, { isDev: false })).toEqual({
      kind: 'configured',
      env: { secretKey: 'sk_test_x', trialPriceId: 'price_x' },
    })
    expect(resolveStripeEnv(ok, { isDev: true })).toEqual({
      kind: 'configured',
      env: { secretKey: 'sk_test_x', trialPriceId: 'price_x' },
    })
  })

  it('returns missing (naming the missing key) when a key is absent in prod', () => {
    expect(resolveStripeEnv({ STRIPE_TRIAL_PRICE_ID: 'price_x' }, { isDev: false })).toEqual({
      kind: 'missing',
      reason: 'STRIPE_SECRET_KEY',
    })
    expect(resolveStripeEnv({ STRIPE_SECRET_KEY: 'sk_test_x' }, { isDev: false })).toEqual({
      kind: 'missing',
      reason: 'STRIPE_TRIAL_PRICE_ID',
    })
  })

  it('returns skip-dev (naming the missing key) when a key is absent in dev', () => {
    expect(resolveStripeEnv({ STRIPE_TRIAL_PRICE_ID: 'price_x' }, { isDev: true })).toEqual({
      kind: 'skip-dev',
      reason: 'STRIPE_SECRET_KEY',
    })
    expect(resolveStripeEnv({}, { isDev: true })).toEqual({
      kind: 'skip-dev',
      reason: 'STRIPE_SECRET_KEY',
    })
  })
})

function fakeStripe(overrides: {
  createCustomer?: (...args: unknown[]) => Promise<{ id: string }>
  createSubscription?: (...args: unknown[]) => Promise<{ id: string }>
}) {
  const customersCreate = vi.fn(
    overrides.createCustomer ?? (async () => ({ id: 'cus_new' })),
  )
  const subscriptionsCreate = vi.fn(
    overrides.createSubscription ?? (async () => ({ id: 'sub_new' })),
  )
  return {
    client: {
      customers: { create: customersCreate },
      subscriptions: { create: subscriptionsCreate },
    } as unknown as Stripe,
    customersCreate,
    subscriptionsCreate,
  }
}

describe('ensureStripeTrialSubscription', () => {
  const baseArgs = {
    organizationId: 'org_123',
    orgName: 'Acme',
    email: 'ada@example.com',
    trialPriceId: 'price_trial',
  }

  it('creates a customer and subscription on a fresh signup with the expected idempotency keys', async () => {
    const { client, customersCreate, subscriptionsCreate } = fakeStripe({})
    const now = 1_700_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000)

    const result = await ensureStripeTrialSubscription({
      stripe: client,
      ...baseArgs,
      existingCustomerId: null,
      existingSubscriptionId: null,
    })

    expect(result).toEqual({ customerId: 'cus_new', subscriptionId: 'sub_new' })
    expect(customersCreate).toHaveBeenCalledWith(
      {
        name: 'Acme',
        email: 'ada@example.com',
        metadata: { organizationId: 'org_123' },
      },
      { idempotencyKey: 'org-org_123:customer' },
    )
    expect(subscriptionsCreate).toHaveBeenCalledWith(
      {
        customer: 'cus_new',
        items: [{ price: 'price_trial' }],
        trial_end: now + TRIAL_PERIOD_DAYS * 86400,
        metadata: { organizationId: 'org_123' },
      },
      { idempotencyKey: 'org-org_123:sub:trial' },
    )
  })

  it('reuses an existing customer id and still creates a subscription when subscription is absent', async () => {
    const { client, customersCreate, subscriptionsCreate } = fakeStripe({})

    const result = await ensureStripeTrialSubscription({
      stripe: client,
      ...baseArgs,
      existingCustomerId: 'cus_existing',
      existingSubscriptionId: null,
    })

    expect(customersCreate).not.toHaveBeenCalled()
    expect(subscriptionsCreate).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ customerId: 'cus_existing', subscriptionId: 'sub_new' })
  })

  it('short-circuits when both customer and subscription already exist', async () => {
    const { client, customersCreate, subscriptionsCreate } = fakeStripe({})

    const result = await ensureStripeTrialSubscription({
      stripe: client,
      ...baseArgs,
      existingCustomerId: 'cus_existing',
      existingSubscriptionId: 'sub_existing',
    })

    expect(customersCreate).not.toHaveBeenCalled()
    expect(subscriptionsCreate).not.toHaveBeenCalled()
    expect(result).toEqual({ customerId: 'cus_existing', subscriptionId: 'sub_existing' })
  })

  it('propagates errors from the underlying Stripe client', async () => {
    const { client } = fakeStripe({
      createCustomer: async () => {
        throw new Error('stripe down')
      },
    })

    await expect(
      ensureStripeTrialSubscription({
        stripe: client,
        ...baseArgs,
        existingCustomerId: null,
        existingSubscriptionId: null,
      }),
    ).rejects.toThrow(/stripe down/)
  })
})

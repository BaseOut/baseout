import { describe, it, expect } from 'vitest'
import { validateOnboardingInput, OnboardingError } from './complete'

// Integration coverage for provisionOnboarding/persistStripeIds/markTermsAccepted
// (the full DB transaction + Stripe round-trip) is deferred until a Dockerized
// Postgres fixture + msw Stripe harness are wired into the test suite. See the
// PR description for the follow-up task.

const ok = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  jobTitle: 'Founder',
  orgName: 'Acme',
  termsAccepted: true,
}

describe('validateOnboardingInput', () => {
  it('accepts the required payload and returns trimmed, composed values', () => {
    const result = validateOnboardingInput({
      ...ok,
      firstName: '  Ada  ',
      lastName: ' Lovelace ',
      jobTitle: ' Founder ',
      orgName: ' Acme ',
    })
    expect(result).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      jobTitle: 'Founder',
      orgName: 'Acme',
      referralSource: null,
      marketingOptIn: false,
      referralCode: null,
      previewSessionId: null,
    })
  })

  it('composes fullName from firstName + " " + lastName', () => {
    const result = validateOnboardingInput({ ...ok, firstName: 'Jane', lastName: 'Doe' })
    expect(result.fullName).toBe('Jane Doe')
  })

  it.each([
    ['firstName', { firstName: '' }, /First name is required/],
    ['lastName', { lastName: '' }, /Last name is required/],
    ['jobTitle', { jobTitle: '' }, /Job title is required/],
    ['orgName', { orgName: '' }, /Organization name is required/],
  ])('rejects a missing %s', (_label, override, pattern) => {
    expect(() => validateOnboardingInput({ ...ok, ...override })).toThrow(pattern)
  })

  it('rejects a name over 100 chars', () => {
    expect(() => validateOnboardingInput({ ...ok, firstName: 'x'.repeat(101) })).toThrow(/100/)
    expect(() => validateOnboardingInput({ ...ok, lastName: 'x'.repeat(101) })).toThrow(/100/)
  })

  it('rejects orgName over 100 chars', () => {
    expect(() => validateOnboardingInput({ ...ok, orgName: 'x'.repeat(101) })).toThrow(/100/)
  })

  it('rejects termsAccepted !== true (even truthy values)', () => {
    expect(() => validateOnboardingInput({ ...ok, termsAccepted: false })).toThrow(/terms/)
    expect(() => validateOnboardingInput({ ...ok, termsAccepted: 'yes' })).toThrow(/terms/)
    expect(() => validateOnboardingInput({ ...ok, termsAccepted: 1 })).toThrow(/terms/)
  })

  it('rejects non-string required fields', () => {
    expect(() =>
      validateOnboardingInput({ ...ok, firstName: 42 as unknown as string }),
    ).toThrow(OnboardingError)
  })

  it('carries the failing field on the OnboardingError', () => {
    try {
      validateOnboardingInput({ ...ok, orgName: '' })
      throw new Error('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(OnboardingError)
      const e = err as OnboardingError
      expect(e.detail.kind).toBe('invalid')
      if (e.detail.kind === 'invalid') expect(e.detail.field).toBe('orgName')
    }
  })

  describe('referralSource', () => {
    it('accepts each allowed value', () => {
      for (const value of ['google', 'twitter_x', 'friend', 'podcast', 'other']) {
        expect(
          validateOnboardingInput({ ...ok, referralSource: value }).referralSource,
        ).toBe(value)
      }
    })

    it('treats absent / empty-string / null as null', () => {
      expect(validateOnboardingInput({ ...ok }).referralSource).toBeNull()
      expect(
        validateOnboardingInput({ ...ok, referralSource: '' }).referralSource,
      ).toBeNull()
      expect(
        validateOnboardingInput({ ...ok, referralSource: null }).referralSource,
      ).toBeNull()
    })

    it('rejects a value outside the allowed enum', () => {
      expect(() => validateOnboardingInput({ ...ok, referralSource: 'tiktok' })).toThrow(
        /Invalid referral source/,
      )
    })
  })

  describe('marketingOptIn', () => {
    it('only treats literal true as opted-in', () => {
      expect(validateOnboardingInput({ ...ok }).marketingOptIn).toBe(false)
      expect(validateOnboardingInput({ ...ok, marketingOptIn: false }).marketingOptIn).toBe(false)
      expect(validateOnboardingInput({ ...ok, marketingOptIn: 'on' }).marketingOptIn).toBe(false)
      expect(validateOnboardingInput({ ...ok, marketingOptIn: true }).marketingOptIn).toBe(true)
    })
  })

  describe('referralCode', () => {
    it('passes through a trimmed non-empty string', () => {
      expect(
        validateOnboardingInput({ ...ok, referralCode: '  ref-123  ' }).referralCode,
      ).toBe('ref-123')
    })

    it('maps empty / missing / non-string to null', () => {
      expect(validateOnboardingInput({ ...ok }).referralCode).toBeNull()
      expect(validateOnboardingInput({ ...ok, referralCode: '   ' }).referralCode).toBeNull()
      expect(validateOnboardingInput({ ...ok, referralCode: 42 }).referralCode).toBeNull()
    })
  })

  describe('previewSessionId', () => {
    it('passes through a trimmed string', () => {
      expect(
        validateOnboardingInput({ ...ok, previewSessionId: '  abc123  ' }).previewSessionId,
      ).toBe('abc123')
    })

    it('maps empty / missing to null', () => {
      expect(validateOnboardingInput({ ...ok }).previewSessionId).toBeNull()
      expect(
        validateOnboardingInput({ ...ok, previewSessionId: '' }).previewSessionId,
      ).toBeNull()
    })
  })
})

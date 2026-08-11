/**
 * TOTP parity tests (web-auth-2fa — disable-requires-factor).
 * RFC 6238 Appendix B vectors pin HMAC-SHA-1 correctness; the rest pins the
 * verify window semantics @better-auth/utils/otp uses.
 */

import { describe, expect, it } from 'vitest'
import { generateTotpCode, verifyTotpCode } from './totp'

// RFC 6238 test secret (SHA-1): ASCII "12345678901234567890".
const RFC_SECRET = '12345678901234567890'

describe('generateTotpCode — RFC 6238 vectors (SHA-1, 8 digits)', () => {
  it.each([
    [59_000, '94287082'],
    [1_111_111_109_000, '07081804'],
    [1_234_567_890_000, '89005924'],
  ])('at t=%dms → %s', async (ms, expected) => {
    const code = await generateTotpCode(RFC_SECRET, {
      digits: 8,
      now: () => ms,
    })
    expect(code).toBe(expected)
  })
})

describe('verifyTotpCode', () => {
  it('accepts the current code and the ±1 window', async () => {
    const now = 1_234_567_890_000
    const current = await generateTotpCode(RFC_SECRET, { now: () => now })
    const previous = await generateTotpCode(RFC_SECRET, {
      now: () => now - 30_000,
    })
    expect(await verifyTotpCode(RFC_SECRET, current, { now: () => now })).toBe(true)
    expect(await verifyTotpCode(RFC_SECRET, previous, { now: () => now })).toBe(true)
  })

  it('rejects stale and wrong codes', async () => {
    const now = 1_234_567_890_000
    const stale = await generateTotpCode(RFC_SECRET, {
      now: () => now - 120_000,
    })
    expect(await verifyTotpCode(RFC_SECRET, stale, { now: () => now })).toBe(false)
    expect(await verifyTotpCode(RFC_SECRET, '000000', { now: () => now })).toBe(false)
  })
})

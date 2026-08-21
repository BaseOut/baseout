import { describe, expect, it } from 'vitest'
import { secretFromOtpauth } from './otpauth'

describe('secretFromOtpauth', () => {
  it('reads the secret query param from an otpauth URI', () => {
    expect(
      secretFromOtpauth(
        'otpauth://totp/Baseout:ada@acme.com?secret=JBSWY3DPEHPK3PXP&issuer=Baseout',
      ),
    ).toBe('JBSWY3DPEHPK3PXP')
  })

  it('returns empty when the URI has no secret', () => {
    expect(secretFromOtpauth('otpauth://totp/Baseout:ada@acme.com')).toBe('')
    expect(secretFromOtpauth('not-a-uri')).toBe('')
  })
})

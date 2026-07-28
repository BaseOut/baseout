/**
 * RFC 6238 TOTP verification (web-auth-2fa — disable-requires-factor).
 *
 * Byte-for-byte compatible with @better-auth/utils/otp's `createOTP`
 * (HMAC-SHA-1, 6 digits, 30s period, ±1 window, utf8 string secret): the
 * codes verified here are the ones the stock plugin's authenticator
 * enrollment produces. Implemented locally because @better-auth/utils is
 * not a direct dependency of apps/web (pnpm strict resolution).
 */

async function generateHotp(
  secret: string,
  counter: number,
  digits: number,
): Promise<string> {
  const buffer = new ArrayBuffer(8)
  new DataView(buffer).setBigUint64(0, BigInt(counter), false)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign'],
  )
  const hmac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new Uint8Array(buffer)),
  )
  const offset = hmac[hmac.length - 1] & 15
  const truncated =
    ((hmac[offset] & 127) << 24) |
    ((hmac[offset + 1] & 255) << 16) |
    ((hmac[offset + 2] & 255) << 8) |
    (hmac[offset + 3] & 255)
  return (truncated % 10 ** digits).toString().padStart(digits, '0')
}

export interface TotpOptions {
  digits?: number
  period?: number
  window?: number
  /** Injectable clock for tests. */
  now?: () => number
}

/** Current TOTP code for a secret (test + parity helper). */
export async function generateTotpCode(
  secret: string,
  options: TotpOptions = {},
): Promise<string> {
  const digits = options.digits ?? 6
  const period = options.period ?? 30
  const now = options.now ?? Date.now
  const counter = Math.floor(now() / (period * 1000))
  return generateHotp(secret, counter, digits)
}

/** Verify a TOTP code within ±window periods (default ±1). */
export async function verifyTotpCode(
  secret: string,
  code: string,
  options: TotpOptions = {},
): Promise<boolean> {
  const digits = options.digits ?? 6
  const period = options.period ?? 30
  const window = options.window ?? 1
  const now = options.now ?? Date.now
  const counter = Math.floor(now() / (period * 1000))
  for (let i = -window; i <= window; i++) {
    if ((await generateHotp(secret, counter + i, digits)) === code) return true
  }
  return false
}

/** Pull the TOTP secret out of an otpauth:// URI (better-auth enable response). */
export function secretFromOtpauth(uri: string): string {
  try {
    const parsed = new URL(uri)
    return parsed.searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

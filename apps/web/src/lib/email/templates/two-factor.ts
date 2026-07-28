/**
 * 2FA security-notification emails (web-auth-2fa). Same rendered shape as
 * templates/magic-link.ts.
 */

import type { RenderedEmail } from './magic-link'

export type TwoFactorEmailKind =
  | 'enabled'
  | 'disabled'
  | 'backup_code_consumed'
  | 'challenge_failed'

const COPY: Record<TwoFactorEmailKind, { subject: string; lines: string[] }> = {
  enabled: {
    subject: 'Two-factor authentication was enabled on your account',
    lines: [
      'Two-factor authentication (authenticator app) is now active on your account.',
      'From now on, signing in on an untrusted device requires a code from your authenticator app.',
      'Keep your backup codes somewhere safe — they are the only self-service recovery path.',
    ],
  },
  disabled: {
    subject: 'Two-factor authentication was disabled on your account',
    lines: [
      'Two-factor authentication was just disabled on your account.',
      'Sign-ins no longer require an authenticator code.',
    ],
  },
  backup_code_consumed: {
    subject: 'A backup code was used to sign in',
    lines: [
      'One of your two-factor backup codes was just used to sign in.',
      'Each backup code works only once. If you are running low, generate a new set from your security settings.',
    ],
  },
  challenge_failed: {
    subject: 'Failed two-factor attempt on your account',
    lines: [
      'A sign-in to your account failed the two-factor challenge.',
      'If this was you, try again with a current code from your authenticator app.',
    ],
  },
}

const FOOTER =
  'If you did not do this, contact support immediately — someone may have access to your email.'

export function renderTwoFactorEmail(input: {
  kind: TwoFactorEmailKind
  productName?: string
}): RenderedEmail {
  const productName = input.productName ?? 'Baseout'
  const { subject, lines } = COPY[input.kind]

  const text = [`${productName} security notification`, '', ...lines, '', FOOTER].join('\n')

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${subject}</h1>
    ${lines.map((l) => `<p style="margin: 0 0 12px;">${l}</p>`).join('\n    ')}
    <p style="margin: 16px 0 0; font-size: 12px; color: #888;">${FOOTER}</p>
  </body>
</html>`

  return { subject: `${subject} — ${productName}`, html, text }
}

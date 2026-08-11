// Pure copy resolution for the /auth/sign-in page. Reasons and handoff error
// codes are whitelisted — unknown query values fall back to the generic copy
// and are never echoed into the page.

export type SignInReason = 'no-session' | 'expired' | 'signed-out'
export type HandoffError = 'missing_token' | 'invalid_token' | 'session_invalid' | 'misconfigured'

export interface SignInView {
  headline: string
  detail: string
  /** Handoff-failure note rendered as an error Alert; null when none. */
  errorNote: string | null
}

const DEFAULT_DETAIL =
  'This is the Baseout staff console. Sign in with your staff account to continue.'

const REASON_COPY: Record<SignInReason, { headline: string; detail: string }> = {
  'no-session': { headline: 'Sign in', detail: DEFAULT_DETAIL },
  expired: {
    headline: 'Session expired',
    detail: 'Your session expired. Sign in again to continue.',
  },
  'signed-out': {
    headline: 'Signed out',
    detail: 'You are signed out of the staff console.',
  },
}

const ERROR_COPY: Record<HandoffError, string> = {
  missing_token: 'The sign-in link was missing its token. Start again below.',
  invalid_token:
    'The sign-in link is invalid or has expired — handoff tokens last 60 seconds. Start again below.',
  session_invalid: 'Your session did not validate. Sign in again below.',
  misconfigured:
    'The console is missing its handoff secret (ADMIN_HANDOFF_SECRET). Fix the deployment, then sign in again.',
}

function isReason(value: string | null): value is SignInReason {
  return value === 'no-session' || value === 'expired' || value === 'signed-out'
}

function isHandoffError(value: string | null): value is HandoffError {
  return value === 'missing_token' || value === 'invalid_token'
    || value === 'session_invalid' || value === 'misconfigured'
}

export function signInView(reason: string | null, error: string | null): SignInView {
  const base = isReason(reason) ? REASON_COPY[reason] : REASON_COPY['no-session']
  return {
    ...base,
    errorNote: isHandoffError(error) ? ERROR_COPY[error] : null,
  }
}

/**
 * Web's /login honors a validated returnTo and uses it as the magic-link
 * callback (baseout.local origins verbatim; deployed admin origins route via
 * web's /api/admin/handoff). Only the ORIGIN can round-trip — deep paths are
 * not preserved by the deployed handoff, so we deliberately pass just origin.
 */
export function buildLoginUrl(webAppUrl: string, selfOrigin: string): string {
  return `${webAppUrl}/login?returnTo=${encodeURIComponent(selfOrigin)}`
}

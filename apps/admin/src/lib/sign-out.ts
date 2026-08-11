// Cookie deletions for the staff-console sign-out.
//
// HONESTY NOTE: admin never mutates `sessions` rows — this clears cookies
// only. The web session row survives, and web's own logout remains the
// server-side kill. What this achieves per environment:
//   - deployed: `baseout_admin_session` is admin's own copy of the session
//     token (set by /auth/handoff) — clearing it fully signs the deployed
//     console out.
//   - local dev: web and admin share the baseout.local host, so clearing
//     web's better-auth cookie signs you out of BOTH apps locally (ports
//     don't scope cookies). Simple and honest — staff expecting "sign out"
//     get signed out.

const BASE = 'Max-Age=0; Path=/; HttpOnly; SameSite=Lax'

export function signOutCookieHeaders(secure: boolean): string[] {
  const suffix = secure ? '; Secure' : ''
  const headers = [
    `baseout_admin_session=; ${BASE}${suffix}`,
    `better-auth.session_token=; ${BASE}${suffix}`,
  ]
  if (secure) {
    // The prod-variant cookie name only exists on https origins; deleting it
    // requires the Secure attribute. No-op when absent.
    headers.push(`__Secure-better-auth.session_token=; ${BASE}; Secure`)
  }
  return headers
}

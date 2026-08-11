// Pure gate-decision → response-outcome mapping for the middleware.
//
// The middleware looks up the session and calls decideAccess (admin-session.ts);
// this module turns that decision plus the request path into what the response
// should be, so the whole policy is testable without a DB or a Request:
//   - pages redirect to the on-brand /auth/sign-in and /auth/forbidden pages
//     (which replaced the old inline hardcoded-HTML 403s),
//   - /api/* paths answer JSON 401/403 (the contract postAction clients expect),
//   - the auth pages themselves render for the signed-out and bounce signed-in
//     staff back home (loop protection),
//   - /api/auth/sign-out is unconditionally allowed — an expired user must
//     still be able to sign out.
// /auth/handoff is exempted earlier in the middleware (it validates itself).

import type { GateDecision } from './admin-session'

export type GateOutcome =
  | { kind: 'next' }
  | { kind: 'redirect'; location: string }
  | { kind: 'json'; status: 401 | 403; error: string }

export function gateOutcome(decision: GateDecision, pathname: string): GateOutcome {
  // Sign-out must always be reachable, even with a dead session.
  if (pathname === '/api/auth/sign-out') return { kind: 'next' }

  if (decision.ok) {
    // Signed-in staff visiting an auth page bounce home. This is the inverse
    // of the redirect-loop guard: the only redirects the gate ever issues
    // target these pages, and these pages only redirect signed-in staff to
    // '/', which renders — so no loop is possible.
    if (pathname === '/auth/sign-in' || pathname === '/auth/forbidden') {
      return { kind: 'redirect', location: '/' }
    }
    return { kind: 'next' }
  }

  // The sign-in page is the destination for the signed-out — let it render.
  if (pathname === '/auth/sign-in') return { kind: 'next' }

  // The forbidden page only makes sense for the signed-in-but-not-staff; a
  // signed-out visitor landing there directly goes to sign-in instead.
  if (pathname === '/auth/forbidden') {
    return decision.reason === 'not-staff'
      ? { kind: 'next' }
      : { kind: 'redirect', location: `/auth/sign-in?reason=${decision.reason}` }
  }

  if (pathname.startsWith('/api/')) {
    return decision.reason === 'not-staff'
      ? { kind: 'json', status: 403, error: 'staff_only' }
      : { kind: 'json', status: 401, error: 'unauthenticated' }
  }

  if (decision.reason === 'not-staff') {
    return { kind: 'redirect', location: '/auth/forbidden' }
  }
  return { kind: 'redirect', location: `/auth/sign-in?reason=${decision.reason}` }
}

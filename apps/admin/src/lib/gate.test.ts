import { describe, expect, it } from 'vitest'
import { gateOutcome } from './gate'
import type { GateDecision } from './admin-session'

const OK: GateDecision = { ok: true }
const NO_SESSION: GateDecision = { ok: false, reason: 'no-session' }
const EXPIRED: GateDecision = { ok: false, reason: 'expired' }
const NOT_STAFF: GateDecision = { ok: false, reason: 'not-staff' }

describe('gateOutcome', () => {
  it('lets staff through to pages and APIs', () => {
    expect(gateOutcome(OK, '/')).toEqual({ kind: 'next' })
    expect(gateOutcome(OK, '/backups')).toEqual({ kind: 'next' })
    expect(gateOutcome(OK, '/api/actions/force-backup')).toEqual({ kind: 'next' })
  })

  it('bounces signed-in staff off the auth pages (loop protection)', () => {
    expect(gateOutcome(OK, '/auth/sign-in')).toEqual({ kind: 'redirect', location: '/' })
    expect(gateOutcome(OK, '/auth/forbidden')).toEqual({ kind: 'redirect', location: '/' })
  })

  it('redirects the signed-out to sign-in with the reason', () => {
    expect(gateOutcome(NO_SESSION, '/')).toEqual({
      kind: 'redirect',
      location: '/auth/sign-in?reason=no-session',
    })
    expect(gateOutcome(EXPIRED, '/backups')).toEqual({
      kind: 'redirect',
      location: '/auth/sign-in?reason=expired',
    })
  })

  it('redirects the signed-in non-staff to forbidden', () => {
    expect(gateOutcome(NOT_STAFF, '/')).toEqual({
      kind: 'redirect',
      location: '/auth/forbidden',
    })
  })

  it('answers API paths with JSON instead of redirects', () => {
    expect(gateOutcome(NO_SESSION, '/api/actions/force-backup')).toEqual({
      kind: 'json',
      status: 401,
      error: 'unauthenticated',
    })
    expect(gateOutcome(EXPIRED, '/api/actions/force-backup')).toEqual({
      kind: 'json',
      status: 401,
      error: 'unauthenticated',
    })
    expect(gateOutcome(NOT_STAFF, '/api/actions/force-backup')).toEqual({
      kind: 'json',
      status: 403,
      error: 'staff_only',
    })
  })

  it('lets the signed-out render the sign-in page (it is the destination)', () => {
    expect(gateOutcome(NO_SESSION, '/auth/sign-in')).toEqual({ kind: 'next' })
    expect(gateOutcome(EXPIRED, '/auth/sign-in')).toEqual({ kind: 'next' })
  })

  it('routes forbidden-page visitors by reason', () => {
    expect(gateOutcome(NOT_STAFF, '/auth/forbidden')).toEqual({ kind: 'next' })
    expect(gateOutcome(NO_SESSION, '/auth/forbidden')).toEqual({
      kind: 'redirect',
      location: '/auth/sign-in?reason=no-session',
    })
  })

  it('always lets sign-out through, regardless of session state', () => {
    expect(gateOutcome(OK, '/api/auth/sign-out')).toEqual({ kind: 'next' })
    expect(gateOutcome(NO_SESSION, '/api/auth/sign-out')).toEqual({ kind: 'next' })
    expect(gateOutcome(EXPIRED, '/api/auth/sign-out')).toEqual({ kind: 'next' })
    expect(gateOutcome(NOT_STAFF, '/api/auth/sign-out')).toEqual({ kind: 'next' })
  })
})

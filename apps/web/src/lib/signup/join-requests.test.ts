/**
 * Pure decision-logic tests for the join-request lifecycle
 * (openspec/changes/web-signup-domain-association task 2.3; design
 * Decision 4). DB wrappers are exercised through the route tests with
 * injected deps.
 */

import { describe, expect, it } from 'vitest'
import {
  DECLINE_COOLDOWN_MS,
  evaluateCreateRequest,
  evaluateDecision,
  JOIN_REQUEST_EXPIRY_MS,
  type JoinRequestSnapshot,
} from './join-requests'

const NOW = new Date('2026-07-27T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function req(overrides: Partial<JoinRequestSnapshot> = {}): JoinRequestSnapshot {
  return {
    id: 'jr_1',
    organizationId: 'org_1',
    requesterUserId: 'u_1',
    status: 'pending',
    expiresAt: new Date(NOW.getTime() + 5 * DAY),
    declineCooldownUntil: null,
    createdAt: new Date(NOW.getTime() - 2 * DAY),
    ...overrides,
  }
}

describe('constants', () => {
  it('expiry ~7 days, decline cool-down ~30 days (design open Qs 1+2)', () => {
    expect(JOIN_REQUEST_EXPIRY_MS).toBe(7 * DAY)
    expect(DECLINE_COOLDOWN_MS).toBe(30 * DAY)
  })
})

describe('evaluateCreateRequest', () => {
  it('allows a first request and stamps ~7d expiry', () => {
    const out = evaluateCreateRequest({ now: NOW, existing: [] })
    expect(out).toEqual({
      ok: true,
      expiresAt: new Date(NOW.getTime() + JOIN_REQUEST_EXPIRY_MS),
    })
  })

  it('rejects when an open (pending, unexpired) request exists', () => {
    const out = evaluateCreateRequest({ now: NOW, existing: [req()] })
    expect(out).toEqual({ ok: false, reason: 'pending_exists' })
  })

  it('allows re-request when the previous pending request expired', () => {
    const out = evaluateCreateRequest({
      now: NOW,
      existing: [req({ expiresAt: new Date(NOW.getTime() - DAY) })],
    })
    expect(out.ok).toBe(true)
  })

  it('rejects during the decline cool-down', () => {
    const until = new Date(NOW.getTime() + 10 * DAY)
    const out = evaluateCreateRequest({
      now: NOW,
      existing: [req({ status: 'declined', declineCooldownUntil: until })],
    })
    expect(out).toEqual({ ok: false, reason: 'cooldown', until })
  })

  it('allows once the cool-down has elapsed', () => {
    const out = evaluateCreateRequest({
      now: NOW,
      existing: [
        req({
          status: 'declined',
          declineCooldownUntil: new Date(NOW.getTime() - DAY),
        }),
      ],
    })
    expect(out.ok).toBe(true)
  })

  it('approved history does not block a new request', () => {
    const out = evaluateCreateRequest({
      now: NOW,
      existing: [req({ status: 'approved' })],
    })
    expect(out.ok).toBe(true)
  })
})

describe('evaluateDecision', () => {
  it('only org owners/admins may decide', () => {
    expect(
      evaluateDecision({ request: req(), actorRole: 'member', now: NOW, action: 'approve' }),
    ).toEqual({ ok: false, reason: 'not_admin' })
    expect(
      evaluateDecision({ request: req(), actorRole: null, now: NOW, action: 'approve' }),
    ).toEqual({ ok: false, reason: 'not_admin' })
  })

  it('approve transitions pending → approved', () => {
    const out = evaluateDecision({
      request: req(),
      actorRole: 'owner',
      now: NOW,
      action: 'approve',
    })
    expect(out).toEqual({ ok: true, nextStatus: 'approved', declineCooldownUntil: null })
  })

  it('decline stamps the 30-day cool-down', () => {
    const out = evaluateDecision({
      request: req(),
      actorRole: 'admin',
      now: NOW,
      action: 'decline',
    })
    expect(out).toEqual({
      ok: true,
      nextStatus: 'declined',
      declineCooldownUntil: new Date(NOW.getTime() + DECLINE_COOLDOWN_MS),
    })
  })

  it('rejects deciding a non-pending request', () => {
    const out = evaluateDecision({
      request: req({ status: 'declined' }),
      actorRole: 'owner',
      now: NOW,
      action: 'approve',
    })
    expect(out).toEqual({ ok: false, reason: 'not_pending' })
  })

  it('rejects deciding an expired-window pending request', () => {
    const out = evaluateDecision({
      request: req({ expiresAt: new Date(NOW.getTime() - DAY) }),
      actorRole: 'owner',
      now: NOW,
      action: 'approve',
    })
    expect(out).toEqual({ ok: false, reason: 'expired' })
  })
})

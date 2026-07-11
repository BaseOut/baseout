/**
 * Tests for handleInboxTriage + parseTriageBody (web-notifications-inbox §5.1):
 * server-side validation, auth/IDOR reuse, engine forwarding, and the 422
 * state-backed-done passthrough.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleInboxTriage, parseTriageBody } = await import('./triage')

import type { AccountContext } from '../../../../../lib/account'
import type { TriageNotificationResult } from '../../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
  } as AccountContext
}

const inOrg = vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID }))

const baseInput = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  body: { itemId: 'run:r1', action: 'done' },
  fetchSpace: inOrg,
}

describe('parseTriageBody', () => {
  it('accepts every triage action', () => {
    for (const action of ['read', 'unread', 'done', 'undone', 'snooze', 'unsnooze']) {
      expect(parseTriageBody({ itemId: 'run:r1', action })).toEqual({ itemId: 'run:r1', action })
    }
  })

  it('normalizes snoozedUntil to ISO', () => {
    const out = parseTriageBody({
      itemId: 'run:r1',
      action: 'snooze',
      snoozedUntil: '2026-07-11T10:00:00Z',
    })
    expect(out?.snoozedUntil).toBe('2026-07-11T10:00:00.000Z')
  })

  it.each([
    ['null body', null],
    ['missing itemId', { action: 'done' }],
    ['empty itemId', { itemId: '', action: 'done' }],
    ['oversized itemId', { itemId: 'x'.repeat(257), action: 'done' }],
    ['unknown action', { itemId: 'run:r1', action: 'archive' }],
    ['non-string action', { itemId: 'run:r1', action: 7 }],
    ['garbage snoozedUntil', { itemId: 'run:r1', action: 'snooze', snoozedUntil: 'tomorrow-ish' }],
    ['non-string snoozedUntil', { itemId: 'run:r1', action: 'snooze', snoozedUntil: 42 }],
  ])('rejects %s', (_name, body) => {
    expect(parseTriageBody(body)).toBeNull()
  })
})

describe('handleInboxTriage', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleInboxTriage({ ...baseInput, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('403 when the Space belongs to another org (IDOR)', async () => {
    const res = await handleInboxTriage({
      ...baseInput,
      fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: 'other-org' })),
      engine: vi.fn(),
    })
    expect(res.status).toBe(403)
  })

  it('400 on an invalid body — engine untouched', async () => {
    const engine = vi.fn()
    const res = await handleInboxTriage({ ...baseInput, body: { action: 'done' }, engine })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleInboxTriage({ ...baseInput, engine: null })
    expect(res.status).toBe(503)
  })

  it('forwards the validated input and returns ok', async () => {
    const engine = vi.fn(async (): Promise<TriageNotificationResult> => ({ ok: true }))
    const res = await handleInboxTriage({
      ...baseInput,
      body: { itemId: 'run:r1', action: 'snooze', snoozedUntil: '2026-07-11T00:00:00.000Z' },
      engine,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, {
      itemId: 'run:r1',
      action: 'snooze',
      snoozedUntil: '2026-07-11T00:00:00.000Z',
    })
  })

  it("passes the engine's 422 state-backed-done rejection through", async () => {
    const engine = vi.fn(
      async (): Promise<TriageNotificationResult> => ({
        ok: false,
        code: 'engine_error',
        status: 422,
      }),
    )
    const res = await handleInboxTriage({
      ...baseInput,
      body: { itemId: 'conn:c1', action: 'done' },
      engine,
    })
    expect(res.status).toBe(422)
  })
})

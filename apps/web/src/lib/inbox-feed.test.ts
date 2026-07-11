/**
 * Tests for the Inbox feed fan-out (web-notifications-inbox §5.1): the pure
 * merge/label rules and the parallel, failure-degrading fetch. The engine
 * client is stubbed at the method boundary — HTTP mapping is pinned in
 * backup-engine.test.ts.
 */

import { describe, expect, it, vi } from 'vitest'
import { fetchInboxItems, inboxProxyStatus, mergeSpaceFeeds } from './inbox-feed'
import type { BackupEngineClient, GetNotificationsResult, InboxItemView } from './backup-engine'

const SPACE_A = { id: '11111111-1111-1111-1111-111111111111', name: 'Acme Ops' }
const SPACE_B = { id: '22222222-2222-2222-2222-222222222222', name: 'Acme Marketing' }

function item(overrides: Partial<InboxItemView> = {}): InboxItemView {
  return {
    id: 'run:r1',
    kind: 'backup-failed',
    title: '*Sales CRM* backup failed',
    at: '2026-07-09T10:00:00.000Z',
    ...overrides,
  }
}

/** Engine stub: getNotifications resolves per-Space via the supplied map. */
function engineStub(
  byBySpace: Record<string, GetNotificationsResult | Promise<GetNotificationsResult>>,
): BackupEngineClient {
  return {
    getNotifications: vi.fn(async (spaceId: string) => byBySpace[spaceId]),
  } as unknown as BackupEngineClient
}

describe('mergeSpaceFeeds', () => {
  it('stamps spaceId on every row but labels space only with 2+ Spaces', () => {
    const single = mergeSpaceFeeds([{ space: SPACE_A, items: [item()] }])
    expect(single[0].spaceId).toBe(SPACE_A.id)
    expect(single[0].space).toBeUndefined()

    const multi = mergeSpaceFeeds([
      { space: SPACE_A, items: [item()] },
      { space: SPACE_B, items: [item({ id: 'run:r2' })] },
    ])
    expect(multi.map((i) => i.space).sort()).toEqual(['Acme Marketing', 'Acme Ops'])
  })

  it('labels rows even when the OTHER Space contributed nothing (account count, not feed count)', () => {
    const merged = mergeSpaceFeeds([
      { space: SPACE_A, items: [item()] },
      { space: SPACE_B, items: [] },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].space).toBe('Acme Ops')
  })

  it('merges newest-first across Spaces', () => {
    const merged = mergeSpaceFeeds([
      { space: SPACE_A, items: [item({ id: 'a-old', at: '2026-07-01T00:00:00.000Z' })] },
      {
        space: SPACE_B,
        items: [
          item({ id: 'b-new', at: '2026-07-09T00:00:00.000Z' }),
          item({ id: 'b-mid', at: '2026-07-05T00:00:00.000Z' }),
        ],
      },
    ])
    expect(merged.map((i) => i.id)).toEqual(['b-new', 'b-mid', 'a-old'])
  })

  it('drops rows with kinds the panel does not know (never crash a render)', () => {
    const merged = mergeSpaceFeeds([
      { space: SPACE_A, items: [item(), item({ id: 'x', kind: 'brand-new-kind' })] },
    ])
    expect(merged.map((i) => i.id)).toEqual(['run:r1'])
  })

  it('preserves triage + mute fields (read/done/snoozedUntil/baseId/stateBacked)', () => {
    const merged = mergeSpaceFeeds([
      {
        space: SPACE_A,
        items: [
          item({
            kind: 'connection-broken',
            id: 'conn:c1',
            baseId: 'appXYZ',
            read: true,
            done: false,
            snoozedUntil: '2026-07-11T00:00:00.000Z',
            stateBacked: true,
          }),
        ],
      },
    ])
    expect(merged[0]).toMatchObject({
      id: 'conn:c1',
      baseId: 'appXYZ',
      read: true,
      snoozedUntil: '2026-07-11T00:00:00.000Z',
      stateBacked: true,
      spaceId: SPACE_A.id,
    })
  })
})

describe('fetchInboxItems', () => {
  it('fans out in parallel and merges both Spaces', async () => {
    const engine = engineStub({
      [SPACE_A.id]: { ok: true, items: [item({ id: 'a1' })] },
      [SPACE_B.id]: { ok: true, items: [item({ id: 'b1', at: '2026-07-10T00:00:00.000Z' })] },
    })
    const items = await fetchInboxItems(engine, [SPACE_A, SPACE_B])
    expect(items.map((i) => i.id)).toEqual(['b1', 'a1'])
    expect(engine.getNotifications).toHaveBeenCalledTimes(2)
  })

  it('degrades a failed Space to [] without dropping the healthy one', async () => {
    const engine = engineStub({
      [SPACE_A.id]: { ok: false, code: 'space_db_not_ready', status: 409 },
      [SPACE_B.id]: { ok: true, items: [item({ id: 'b1' })] },
    })
    const items = await fetchInboxItems(engine, [SPACE_A, SPACE_B])
    expect(items.map((i) => i.id)).toEqual(['b1'])
    // Two account Spaces ⇒ the surviving rows still carry the Space label.
    expect(items[0].space).toBe('Acme Marketing')
  })

  it('degrades a thrown engine call to []', async () => {
    const engine = {
      getNotifications: vi.fn(async () => {
        throw new Error('boom')
      }),
    } as unknown as BackupEngineClient
    await expect(fetchInboxItems(engine, [SPACE_A])).resolves.toEqual([])
  })

  it('times out a hung Space instead of blocking the render', async () => {
    const never = new Promise<GetNotificationsResult>(() => {})
    const engine = engineStub({
      [SPACE_A.id]: never,
      [SPACE_B.id]: { ok: true, items: [item({ id: 'b1' })] },
    })
    const items = await fetchInboxItems(engine, [SPACE_A, SPACE_B], { timeoutMs: 20 })
    expect(items.map((i) => i.id)).toEqual(['b1'])
  })

  it('returns [] for an account with no Spaces', async () => {
    const engine = engineStub({})
    await expect(fetchInboxItems(engine, [])).resolves.toEqual([])
  })
})

describe('inboxProxyStatus', () => {
  it('maps engine_unreachable to 502', () => {
    expect(inboxProxyStatus({ code: 'engine_unreachable', status: 0 })).toBe(502)
  })

  it('passes a 4xx through (the 422 state-backed-done rejection)', () => {
    expect(inboxProxyStatus({ code: 'engine_error', status: 422 })).toBe(422)
  })

  it('falls back to 500 for weird statuses', () => {
    expect(inboxProxyStatus({ code: 'engine_error', status: 0 })).toBe(500)
  })
})

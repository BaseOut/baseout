import { describe, expect, it } from 'vitest'
import { assembleActiveRuns, attentionGroups, DEEP_DIVE, formatElapsed, successRate, type ActiveRunInput } from './dashboard'

const now = new Date('2026-07-20T12:00:00.000Z')
const ago = (min: number) => new Date(now.getTime() - min * 60000)

describe('formatElapsed', () => {
  it('renders minutes / hours / days', () => {
    expect(formatElapsed(ago(14), now)).toBe('14m')
    expect(formatElapsed(ago(120), now)).toBe('2h')
    expect(formatElapsed(ago(60 * 24 * 3), now)).toBe('3d')
    expect(formatElapsed(new Date(now.getTime() + 5000), now)).toBe('0m') // clamps negatives
  })
})

describe('assembleActiveRuns', () => {
  it('merges backup + restore, oldest-first, elapsed from started_at ?? created_at', () => {
    const rows: ActiveRunInput[] = [
      { id: 'r2', kind: 'restore', status: 'running', spaceId: 's', spaceName: 'S', orgId: 'o', orgName: 'O', startedAt: ago(5), createdAt: ago(6) },
      { id: 'r1', kind: 'backup', status: 'queued', spaceId: 's', spaceName: 'S', orgId: 'o', orgName: 'O', startedAt: null, createdAt: ago(30) },
    ]
    const out = assembleActiveRuns(rows, now)
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2']) // r1 (30m via created_at) is older
    expect(out[0].elapsed).toBe('30m')
    expect(out[1].elapsed).toBe('5m')
  })
})

describe('successRate', () => {
  it('is terminal-only and null when the window has no terminal runs', () => {
    expect(successRate(['succeeded', 'succeeded', 'failed'])).toEqual({ rate: 67, succeeded: 2, terminal: 3 })
    expect(successRate(['queued', 'running'])).toEqual({ rate: null, succeeded: 0, terminal: 0 })
    expect(successRate(['trial_complete', 'failed'])).toEqual({ rate: 50, succeeded: 1, terminal: 2 })
  })
})

describe('attentionGroups', () => {
  it('emits only non-empty groups, each with a deep-dive href', () => {
    const groups = attentionGroups({
      overdueSchedules: { count: 2, items: [] },
      unhealthyConnections: { count: 0, items: [] },
      dbErrors: { count: 1, items: [{ label: 'S', sublabel: 'O', href: '/spaces/s' }] },
      recentFailures: { count: 0, items: [] },
    })
    expect(groups.map((g) => g.key)).toEqual(['schedules', 'databases'])
    expect(groups.find((g) => g.key === 'databases')!.href).toBe(DEEP_DIVE.databases)
  })
})

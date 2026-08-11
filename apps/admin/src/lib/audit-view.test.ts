import { describe, expect, it } from 'vitest'
import {
  pairAuditRows,
  summarizeParams,
  AUDIT_OUTCOME_BADGE,
  type AuditIntentRow,
  type AuditResultRow,
} from './audit-view'

const T0 = new Date('2026-07-17T10:00:00Z')
const T1 = new Date('2026-07-17T10:00:01Z')

function intent(overrides: Partial<AuditIntentRow> = {}): AuditIntentRow {
  return {
    id: 'intent-1',
    createdAt: T0,
    actorEmail: 'staff@openside.com',
    action: 'force_backup',
    targetType: 'space',
    targetId: 'space-1',
    organizationId: 'org-1',
    params: { spaceId: 'space-1' },
    ...overrides,
  }
}

describe('pairAuditRows', () => {
  it('pairs a success result onto its intent', () => {
    const results: AuditResultRow[] = [
      { intentId: 'intent-1', createdAt: T1, params: { ok: true, runId: 'run-9' } },
    ]
    const [entry] = pairAuditRows([intent()], results)
    expect(entry.outcome).toBe('ok')
    expect(entry.resultAt).toBe(T1)
    expect(entry.resultCode).toBeNull()
  })

  it('marks a failed result with its code', () => {
    const results: AuditResultRow[] = [
      { intentId: 'intent-1', createdAt: T1, params: { ok: false, code: 'engine_unreachable' } },
    ]
    const [entry] = pairAuditRows([intent()], results)
    expect(entry.outcome).toBe('failed')
    expect(entry.resultCode).toBe('engine_unreachable')
  })

  it('treats exception results as failed', () => {
    const results: AuditResultRow[] = [
      { intentId: 'intent-1', createdAt: T1, params: { ok: false, code: 'exception' } },
    ]
    expect(pairAuditRows([intent()], results)[0].outcome).toBe('failed')
  })

  it('marks a missing result as no_result (outcome unknown)', () => {
    const [entry] = pairAuditRows([intent()], [])
    expect(entry.outcome).toBe('no_result')
    expect(entry.resultAt).toBeNull()
  })

  it('ignores results for other intents and null intentIds', () => {
    const results: AuditResultRow[] = [
      { intentId: 'other', createdAt: T1, params: { ok: true } },
      { intentId: null, createdAt: T1, params: { ok: true } },
    ]
    expect(pairAuditRows([intent()], results)[0].outcome).toBe('no_result')
  })

  it('preserves intent order and tolerates unknown actions', () => {
    const entries = pairAuditRows(
      [intent({ id: 'a', action: 'grant_credits' }), intent({ id: 'b' })],
      [],
    )
    expect(entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(entries[0].action).toBe('grant_credits')
    expect(AUDIT_OUTCOME_BADGE[entries[0].outcome]).toBe('warning')
  })
})

describe('summarizeParams', () => {
  it('renders compact JSON and hides empties', () => {
    expect(summarizeParams({ spaceId: 's1' })).toBe('{"spaceId":"s1"}')
    expect(summarizeParams({})).toBe('')
    expect(summarizeParams(null)).toBe('')
    expect(summarizeParams(undefined)).toBe('')
  })

  it('truncates long payloads', () => {
    const long = summarizeParams({ note: 'x'.repeat(200) })
    expect(long.length).toBeLessThanOrEqual(81)
    expect(long.endsWith('…')).toBe(true)
  })

  it('survives unserializable values', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(summarizeParams(circular)).toBe('[unserializable]')
  })
})

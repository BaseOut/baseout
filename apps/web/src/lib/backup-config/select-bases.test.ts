import { describe, it, expect } from 'vitest'
import { planBaseSelection } from './select-bases'

describe('planBaseSelection', () => {
  const allBaseIds = ['a', 'b', 'c', 'd']

  it('computes the diff against current state', () => {
    const out = planBaseSelection({
      allBaseIds,
      requestedBaseIds: ['a', 'b'],
      currentSelectedIds: ['b', 'c'],
      basesPerSpace: 5,
    })
    expect(out).toEqual({ ok: true, toEnable: ['a'], toDisable: ['c'] })
  })

  it('is idempotent when the request matches current state', () => {
    const out = planBaseSelection({
      allBaseIds,
      requestedBaseIds: ['a', 'c'],
      currentSelectedIds: ['a', 'c'],
      basesPerSpace: 5,
    })
    expect(out).toEqual({ ok: true, toEnable: [], toDisable: [] })
  })

  it('rejects when the request exceeds the tier cap', () => {
    const out = planBaseSelection({
      allBaseIds,
      requestedBaseIds: ['a', 'b', 'c', 'd'],
      currentSelectedIds: [],
      basesPerSpace: 2,
    })
    expect(out).toEqual({
      ok: false,
      reason: 'over_tier_limit',
      limit: 2,
      requested: 4,
    })
  })

  it('treats null basesPerSpace as unlimited (Enterprise)', () => {
    const out = planBaseSelection({
      allBaseIds,
      requestedBaseIds: ['a', 'b', 'c', 'd'],
      currentSelectedIds: [],
      basesPerSpace: null,
    })
    expect(out).toEqual({ ok: true, toEnable: ['a', 'b', 'c', 'd'], toDisable: [] })
  })

  it('rejects unknown base ids', () => {
    const out = planBaseSelection({
      allBaseIds,
      requestedBaseIds: ['a', 'zzz'],
      currentSelectedIds: [],
      basesPerSpace: 5,
    })
    expect(out).toEqual({
      ok: false,
      reason: 'unknown_base',
      unknownIds: ['zzz'],
    })
  })

  it('deduplicates the request before counting', () => {
    const out = planBaseSelection({
      allBaseIds,
      requestedBaseIds: ['a', 'a', 'b'],
      currentSelectedIds: [],
      basesPerSpace: 5,
    })
    expect(out).toEqual({ ok: true, toEnable: ['a', 'b'], toDisable: [] })
  })
})

import { describe, expect, it } from 'vitest'
import { emptyDataPagePayload } from './ssr'
import {
  clearDataPageSnapshots,
  peekDataPageSnapshot,
  rememberDataPageSnapshot,
} from './page-snapshot'

describe('data page snapshot', () => {
  it('returns a remembered payload without copying identity requirements', () => {
    clearDataPageSnapshots()
    const payload = emptyDataPagePayload()
    payload.landingTableId = 'tbl1'
    rememberDataPageSnapshot('space-1', payload)
    expect(peekDataPageSnapshot('space-1')?.landingTableId).toBe('tbl1')
  })

  it('misses after clear', () => {
    rememberDataPageSnapshot('space-1', emptyDataPagePayload())
    clearDataPageSnapshots()
    expect(peekDataPageSnapshot('space-1')).toBeUndefined()
  })
})

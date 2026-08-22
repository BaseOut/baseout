import { describe, expect, it, vi } from 'vitest'
import {
  clearSchemaSnapshots,
  getSchemaCached,
  peekLandingTableId,
  rememberSchemaSnapshot,
} from './schema-snapshot-cache'
import type { GetSchemaResult } from '../backup-engine'

function snapshot(): Extract<GetSchemaResult, { ok: true }> {
  return {
    ok: true,
    bases: [],
    tables: [
      {
        tableId: 'tbl1',
        baseId: 'appA',
        name: 'Deals',
        recordCount: 2,
        fieldCount: 1,
        description: null,
        aiDescription: null,
        descriptionOverride: null,
        status: 'active',
        removedAt: null,
      },
    ],
    fields: [],
    views: [],
  }
}

describe('schema-snapshot-cache', () => {
  it('returns a remembered snapshot without refetching', async () => {
    clearSchemaSnapshots()
    rememberSchemaSnapshot('space-1', snapshot())
    const fetchSchema = vi.fn(async () => snapshot())
    const res = await getSchemaCached('space-1', fetchSchema)
    expect(res.ok).toBe(true)
    expect(fetchSchema).not.toHaveBeenCalled()
    expect(peekLandingTableId('space-1')).toBe('tbl1')
  })

  it('fetches once on a miss, then remembers', async () => {
    clearSchemaSnapshots()
    const fetchSchema = vi.fn(async () => snapshot())
    await getSchemaCached('space-1', fetchSchema)
    await getSchemaCached('space-1', fetchSchema)
    expect(fetchSchema).toHaveBeenCalledTimes(1)
  })
})

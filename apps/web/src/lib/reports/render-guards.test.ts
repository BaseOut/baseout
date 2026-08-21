import { describe, expect, it } from 'vitest'
import { getTrendBases, hasRenderableDataHealth } from './render-guards'

describe('report render guards', () => {
  it('does not read byBase from an empty stubbed trends section', () => {
    expect(getTrendBases({ metrics: [] })).toEqual([])
  })

  it('does not read byBase from a partially shaped trend metric', () => {
    expect(getTrendBases({ metrics: [{ label: 'Records' }] } as never)).toEqual([])
  })

  it('does not render stubbed data health as the final data-health shape', () => {
    expect(
      hasRenderableDataHealth({
        available: false,
        note: 'Data health appears once per-base record and attachment capture lands.',
        stats: [],
        rows: [],
      }),
    ).toBe(false)
  })
})

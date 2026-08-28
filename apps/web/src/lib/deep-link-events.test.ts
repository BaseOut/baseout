// Pure param → event mapping for entity/record deep links (web-entity-deeplinks).
import { describe, expect, it } from 'vitest'
import { deepLinkEventsFrom } from './deep-link-events'

const p = (s: string) => new URLSearchParams(s)

describe('deepLinkEventsFrom', () => {
  it('?entity= → schema:openEntity with the id', () => {
    expect(deepLinkEventsFrom(p('entity=fld123'))).toEqual([
      { type: 'schema:openEntity', detail: { id: 'fld123' } },
    ])
  })

  it('?record=&table= → data:openRecord with id + tableId', () => {
    expect(deepLinkEventsFrom(p('record=rec1&table=tbl1'))).toEqual([
      { type: 'data:openRecord', detail: { id: 'rec1', tableId: 'tbl1' } },
    ])
  })

  it('?record= without table still opens (host resolves the table)', () => {
    expect(deepLinkEventsFrom(p('record=rec1'))).toEqual([
      { type: 'data:openRecord', detail: { id: 'rec1' } },
    ])
  })

  it('blank/absent params → no events; unrelated params ignored', () => {
    expect(deepLinkEventsFrom(p(''))).toEqual([])
    expect(deepLinkEventsFrom(p('entity=%20&record='))).toEqual([])
    expect(deepLinkEventsFrom(p('tab=docs&comment=c1'))).toEqual([])
  })
})

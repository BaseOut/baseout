import { describe, expect, it } from 'vitest'
import { isRefineFacetActive } from './refine-facet-active'

describe('isRefineFacetActive', () => {
  it('is inactive when no user choice has been made', () => {
    expect(
      isRefineFacetActive({
        triggerOn: false,
        selectionVisible: false,
        countBadgeText: null,
      }),
    ).toBe(false)
  })

  it('does not treat an empty visible count badge as an active filter', () => {
    expect(
      isRefineFacetActive({
        triggerOn: false,
        selectionVisible: false,
        countBadgeText: '',
      }),
    ).toBe(false)
  })

  it('counts a facet that is actually narrowing the list', () => {
    expect(
      isRefineFacetActive({
        triggerOn: true,
        selectionVisible: false,
        countBadgeText: '3/5',
      }),
    ).toBe(true)
  })
})

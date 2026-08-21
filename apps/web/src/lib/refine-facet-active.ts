/**
 * Whether a folded FacetFilter (or declared runtime facet) is actually
 * narrowing the list. Empty / hidden count badges are NOT active — they are
 * the total-of-options lie the Filter badge used to show.
 */
export function isRefineFacetActive(state: {
  declared?: '1' | '0'
  triggerOn: boolean
  selectionVisible: boolean
  countBadgeText: string | null
}): boolean {
  if (state.declared === '1') return true
  if (state.declared === '0') return false
  if (state.triggerOn) return true
  if (state.selectionVisible) return true
  return Boolean(state.countBadgeText?.trim())
}

/**
 * Pure planner that turns a "user wants exactly these Bases backed up" request
 * into a (toEnable, toDisable) diff against the current persisted state, or a
 * structured rejection when the request violates a constraint.
 *
 * Caller is responsible for fetching `allBaseIds` (from at_bases),
 * `currentSelectedIds` (from backup_configuration_bases where is_included=true),
 * and `basesPerSpace` (from resolveCapabilities). This function does no I/O.
 */

export interface PlanInputs {
  allBaseIds: string[]
  requestedBaseIds: string[]
  currentSelectedIds: string[]
  basesPerSpace: number | null
}

export type PlanResult =
  | { ok: true; toEnable: string[]; toDisable: string[] }
  | { ok: false; reason: 'over_tier_limit'; limit: number; requested: number }
  | { ok: false; reason: 'unknown_base'; unknownIds: string[] }

export function planBaseSelection(inputs: PlanInputs): PlanResult {
  const requested = Array.from(new Set(inputs.requestedBaseIds))
  const allowed = new Set(inputs.allBaseIds)

  const unknownIds = requested.filter((id) => !allowed.has(id))
  if (unknownIds.length > 0) {
    return { ok: false, reason: 'unknown_base', unknownIds }
  }

  if (inputs.basesPerSpace !== null && requested.length > inputs.basesPerSpace) {
    return {
      ok: false,
      reason: 'over_tier_limit',
      limit: inputs.basesPerSpace,
      requested: requested.length,
    }
  }

  const requestedSet = new Set(requested)
  const currentSet = new Set(inputs.currentSelectedIds)

  const toEnable = requested.filter((id) => !currentSet.has(id))
  const toDisable = inputs.currentSelectedIds.filter((id) => !requestedSet.has(id))

  return { ok: true, toEnable, toDisable }
}

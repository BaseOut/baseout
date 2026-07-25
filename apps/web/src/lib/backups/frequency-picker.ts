/**
 * Decision helpers for FrequencyPicker.astro (web-instant-webhook).
 *
 * The component renders the four Features §6.1 cadences and unlocks Instant
 * only when the tier allows it (Pro+ per the PRD §2.2 ruling recorded in
 * openspec/changes/server-instant-webhook/proposal.md) AND the Space's
 * dynamic DB is ready. Everything with a branch lives here so it's
 * unit-testable without a DOM; the .astro file stays thin.
 */

import type { SaveConfigResult } from './save-config'

export type InstantLockReason = 'tier' | 'dynamic_db'

/**
 * Why the Instant option is locked, or null when selectable. Tier wins over
 * the dynamic-DB reason — upgrading is the first actionable step.
 */
export function instantLockReason(opts: {
  tierAllowsInstant: boolean
  dynamicDbReady: boolean
}): InstantLockReason | null {
  if (!opts.tierAllowsInstant) return 'tier'
  if (!opts.dynamicDbReady) return 'dynamic_db'
  return null
}

/** Customer-facing copy for a locked Instant option. */
export function lockReasonCopy(reason: InstantLockReason): string {
  return reason === 'tier'
    ? 'Instant backups need the Pro plan or above.'
    : "Waiting on this Space's dynamic database — Instant unlocks once it's ready."
}

/**
 * Poll-interval presets (seconds). The tier's platform minimum clamps which
 * are offered; the server re-validates authoritatively
 * (webhook_poll_interval_below_minimum).
 */
export const INTERVAL_CHOICES = [60, 300, 900, 1800, 3600] as const

export function formatIntervalSeconds(seconds: number): string {
  if (seconds % 3600 === 0) {
    const h = seconds / 3600
    return h === 1 ? '1 hour' : `${h} hours`
  }
  const m = Math.round(seconds / 60)
  return m === 1 ? '1 minute' : `${m} minutes`
}

export interface IntervalChoice {
  value: string
  label: string
}

/**
 * Options for the interval <Select>, filtered to the tier minimum. When the
 * saved interval isn't one of the presets (e.g. set by support), it's spliced
 * in so the select reflects reality instead of silently snapping to a preset.
 */
export function intervalChoices(
  tierMinSeconds: number,
  currentSeconds?: number,
): IntervalChoice[] {
  const values = INTERVAL_CHOICES.filter((s) => s >= tierMinSeconds).map(
    (s) => s as number,
  )
  if (
    currentSeconds !== undefined &&
    currentSeconds >= tierMinSeconds &&
    !values.includes(currentSeconds)
  ) {
    values.push(currentSeconds)
    values.sort((a, b) => a - b)
  }
  return values.map((s) => ({
    value: String(s),
    label: `Every ${formatIntervalSeconds(s)}`,
  }))
}

export interface FrequencySaveErrorView {
  /** Inline message for the picker's error line. */
  message: string
  /** Whether the UI should revert the frequency selection to the last saved value. */
  revert: boolean
}

/**
 * Map a saveBackupConfig outcome onto the picker's inline error + revert
 * behavior. Per the spec: cap-reached reverts the selection; below-minimum
 * keeps the user's other edits and names the tier minimum inline.
 */
export function describeFrequencySaveError(
  result: SaveConfigResult,
): FrequencySaveErrorView | null {
  if (result.ok) return null
  switch (result.error) {
    case 'airtable_webhook_cap_reached':
      return {
        revert: true,
        message:
          'This base is already webhook-connected by the maximum number of organizations, so Instant is unavailable for it.',
      }
    case 'webhook_poll_interval_below_minimum':
      return {
        revert: false,
        message:
          result.minimum !== undefined
            ? `Your plan's minimum is every ${formatIntervalSeconds(result.minimum)} — pick a longer interval.`
            : "That interval is below your plan's minimum — pick a longer one.",
      }
    case 'dynamic_db_not_ready':
      return {
        revert: true,
        message:
          "This Space's dynamic database isn't ready yet — Instant unlocks once provisioning completes.",
      }
    case 'frequency_not_allowed':
      return {
        revert: true,
        message: 'That schedule is not available on your plan.',
      }
    case 'unauthenticated':
      return { revert: false, message: 'Please sign in again.' }
    default:
      return {
        revert: false,
        message: 'Could not save the schedule. Please try again.',
      }
  }
}

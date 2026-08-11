/**
 * Webhook attention state for the Space backups view (web-instant-webhook).
 *
 * `airtable_webhooks.status` vocabulary (src/db/schema/core.ts):
 *   'active' | 'notifications_disabled' | 'pending_reauth' | 'inactive'
 *
 * Only `pending_reauth` is customer-facing: the upstream webhook was deleted
 * or the owning Connection needs reauth, so webhook-driven backups are paused
 * until the customer reconnects. `notifications_disabled` self-heals via the
 * renewal cron (the daily safety sweep keeps data flowing meanwhile) and is
 * deliberately NOT surfaced.
 */

export function webhookNeedsReauth(statuses: readonly string[]): boolean {
  return statuses.includes('pending_reauth')
}

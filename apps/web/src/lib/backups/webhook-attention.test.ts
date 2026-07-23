/**
 * Banner-presence rule for the Space backups view (web-instant-webhook):
 * a subscribed webhook in `pending_reauth` pauses webhook-driven backups and
 * needs a customer reconnect, so it banners. `notifications_disabled` is NOT
 * customer-facing — the renewal cron self-heals it while the daily safety
 * sweep keeps data flowing — and must never banner.
 */

import { describe, expect, it } from 'vitest'
import { webhookNeedsReauth } from './webhook-attention'

describe('webhookNeedsReauth', () => {
  it('banners when any subscribed webhook is pending_reauth', () => {
    expect(webhookNeedsReauth(['active', 'pending_reauth'])).toBe(true)
    expect(webhookNeedsReauth(['pending_reauth'])).toBe(true)
  })

  it('does not banner for healthy webhooks', () => {
    expect(webhookNeedsReauth(['active'])).toBe(false)
    expect(webhookNeedsReauth([])).toBe(false)
  })

  it('never surfaces notifications_disabled (self-heals via renewal cron)', () => {
    expect(webhookNeedsReauth(['notifications_disabled'])).toBe(false)
    expect(webhookNeedsReauth(['active', 'notifications_disabled'])).toBe(false)
  })

  it('ignores inactive webhooks (unsubscribed / deleted)', () => {
    expect(webhookNeedsReauth(['inactive'])).toBe(false)
  })
})

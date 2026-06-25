/**
 * Tests for describeDestination — the /backups header destination indicator.
 *
 * The Backups page shows where runs are written and links out to the wizard
 * to change it. Dev/local is the default; r2_managed is parked and routes to
 * the local-disk writer, so both display as the dev destination. A cloud
 * provider whose connection isn't set up surfaces a "needs setup" prompt.
 */

import { describe, expect, it } from 'vitest'
import { describeDestination } from './destination'
import type { StorageDestinationSummary } from '../../stores/connections'

const dest = (over: Partial<StorageDestinationSummary> = {}): StorageDestinationSummary => ({
  type: 'google_drive',
  accountEmail: 'you@example.com',
  connectedAt: '2026-06-24T10:00:00.000Z',
  ...over,
})

describe('describeDestination', () => {
  it('treats local_fs, r2_managed, and missing config as the dev local-disk destination', () => {
    for (const st of ['local_fs', 'r2_managed', null, undefined]) {
      expect(describeDestination(st, null)).toEqual({
        label: 'Dev backups (local disk)',
        needsSetup: false,
      })
    }
  })

  it('labels a connected cloud provider with its account email', () => {
    expect(
      describeDestination('google_drive', dest({ type: 'google_drive', accountEmail: 'a@b.com' })),
    ).toEqual({ label: 'Google Drive (a@b.com)', needsSetup: false })
  })

  it('flags a cloud provider with no matching destination as needing setup', () => {
    expect(describeDestination('google_drive', null)).toEqual({
      label: 'Google Drive',
      needsSetup: true,
    })
  })

  it('flags a type mismatch (chosen provider != connected destination) as needing setup', () => {
    expect(describeDestination('box', dest({ type: 'google_drive' }))).toEqual({
      label: 'Box',
      needsSetup: true,
    })
  })

  it('handles a connected provider with no email (label without parens)', () => {
    expect(
      describeDestination('onedrive', dest({ type: 'onedrive', accountEmail: null })),
    ).toEqual({ label: 'OneDrive', needsSetup: false })
  })

  it('falls back to the raw storageType for an unknown provider', () => {
    expect(describeDestination('s3', null)).toEqual({ label: 's3', needsSetup: true })
  })
})

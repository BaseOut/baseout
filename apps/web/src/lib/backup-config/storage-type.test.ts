/**
 * Pure-function tests for primary-destination (storage_type) transitions
 * under multi-destination (shared-multi-destinations).
 *
 * Two decisions, both pure so they're unit-testable without Postgres
 * (routes own the Drizzle reads/writes, mirroring persist-policy.test.ts):
 *  - decideStorageTypeAfterDisconnect: what storage_type becomes when a
 *    destination row is removed.
 *  - shouldPromoteToPrimary: whether a fresh OAuth connect may take primary.
 */

import { describe, expect, it } from 'vitest'
import {
  decideStorageTypeAfterDisconnect,
  shouldPromoteToPrimary,
} from './storage-type'

describe('decideStorageTypeAfterDisconnect', () => {
  it('leaves the config alone when the disconnected type was not primary', () => {
    expect(
      decideStorageTypeAfterDisconnect({
        currentStorageType: 'google_drive',
        disconnectedType: 'box',
        remainingTypesByRecency: ['google_drive'],
      }),
    ).toBeNull()
  })

  it('repoints to the most recently connected remaining destination', () => {
    expect(
      decideStorageTypeAfterDisconnect({
        currentStorageType: 'google_drive',
        disconnectedType: 'google_drive',
        remainingTypesByRecency: ['box', 'dropbox'],
      }),
    ).toBe('box')
  })

  it('falls back to local_fs when no destination rows remain', () => {
    expect(
      decideStorageTypeAfterDisconnect({
        currentStorageType: 'box',
        disconnectedType: 'box',
        remainingTypesByRecency: [],
      }),
    ).toBe('local_fs')
  })

  it('leaves a missing config alone (nothing to repoint)', () => {
    expect(
      decideStorageTypeAfterDisconnect({
        currentStorageType: null,
        disconnectedType: 'box',
        remainingTypesByRecency: [],
      }),
    ).toBeNull()
  })
})

describe('shouldPromoteToPrimary', () => {
  it('promotes when the config still points at a managed default', () => {
    expect(shouldPromoteToPrimary('r2_managed')).toBe(true)
    expect(shouldPromoteToPrimary('local_fs')).toBe(true)
    expect(shouldPromoteToPrimary(null)).toBe(true)
  })

  it('never steals primary from an explicitly chosen BYOS provider', () => {
    expect(shouldPromoteToPrimary('google_drive')).toBe(false)
    expect(shouldPromoteToPrimary('box')).toBe(false)
    expect(shouldPromoteToPrimary('dropbox')).toBe(false)
    expect(shouldPromoteToPrimary('onedrive')).toBe(false)
  })
})

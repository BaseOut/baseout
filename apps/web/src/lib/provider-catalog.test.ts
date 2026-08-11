import { describe, it, expect } from 'vitest'
import {
  getDestinationProviders,
  destinationMeta,
  isManagedDestination,
  SOURCE_PLATFORMS,
} from './provider-catalog'

describe('getDestinationProviders', () => {
  it('marks managed R2 and Google Drive as available with no env', () => {
    const byId = Object.fromEntries(getDestinationProviders().map((p) => [p.slug, p]))
    expect(byId.r2_managed.availability).toBe('available')
    expect(byId.r2_managed.managed).toBe(true)
    expect(byId.google_drive.availability).toBe('available')
  })

  it('keeps env-gated BYOS providers coming-soon when their client id is absent', () => {
    const byId = Object.fromEntries(getDestinationProviders({}).map((p) => [p.slug, p]))
    expect(byId.dropbox.availability).toBe('coming_soon')
    expect(byId.box.availability).toBe('coming_soon')
    expect(byId.onedrive.availability).toBe('coming_soon')
  })

  it('promotes an env-gated provider to available once its client id is configured', () => {
    const byId = Object.fromEntries(
      getDestinationProviders({
        DROPBOX_OAUTH_CLIENT_ID: 'x',
        MICROSOFT_OAUTH_CLIENT_ID: 'y',
      }).map((p) => [p.slug, p]),
    )
    expect(byId.dropbox.availability).toBe('available')
    expect(byId.onedrive.availability).toBe('available')
    // box stays coming-soon — its id was not provided
    expect(byId.box.availability).toBe('coming_soon')
  })

  it('keeps tier-gated S3 coming-soon regardless of env and carries its tier', () => {
    const byId = Object.fromEntries(
      getDestinationProviders({ BOX_OAUTH_CLIENT_ID: 'x' }).map((p) => [p.slug, p]),
    )
    expect(byId.s3.availability).toBe('coming_soon')
    expect(byId.s3.tier).toBe('growth')
  })

  it('keeps database providers coming-soon', () => {
    const dbs = getDestinationProviders().filter((p) => p.kind === 'database')
    expect(dbs.length).toBeGreaterThan(0)
    expect(dbs.every((p) => p.availability === 'coming_soon')).toBe(true)
  })
})

describe('destinationMeta / isManagedDestination', () => {
  it('returns label + kind for a known provider', () => {
    expect(destinationMeta('google_drive')).toMatchObject({ label: 'Google Drive', kind: 'file' })
  })

  it('returns undefined for an unknown provider', () => {
    expect(destinationMeta('mystery')).toBeUndefined()
  })

  it('treats managed storage (r2_managed, local_fs) as managed, BYOS as not', () => {
    expect(isManagedDestination('r2_managed')).toBe(true)
    expect(isManagedDestination('local_fs')).toBe(true)
    expect(isManagedDestination('google_drive')).toBe(false)
  })
})

describe('SOURCE_PLATFORMS', () => {
  it('has Airtable available and future platforms coming-soon', () => {
    const byId = Object.fromEntries(SOURCE_PLATFORMS.map((p) => [p.slug, p]))
    expect(byId.airtable.availability).toBe('available')
    expect(byId.notion.availability).toBe('coming_soon')
    expect(byId.hubspot.availability).toBe('coming_soon')
    expect(byId.salesforce.availability).toBe('coming_soon')
  })
})

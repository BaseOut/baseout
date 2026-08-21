/**
 * Shell chrome must not block first paint on the engine inbox fan-out.
 * Viewport prefetch of every sidebar link amplified that cost (one full SSR
 * per visible nav target); hover prefetch is the supported workaround.
 */
import { describe, expect, it } from 'vitest'
import {
  navPrefetchStrategy,
  readInboxCache,
  resolveLayoutInboxItems,
  writeInboxCache,
  clearInboxCache,
  INBOX_CACHE_TTL_MS,
} from './shell-chrome'
import type { InboxItem } from '../components/layout/inbox'

const SAMPLE: InboxItem[] = [
  {
    id: 'run:r1',
    kind: 'backup-failed',
    title: '*Sales CRM* backup failed',
    at: '2026-07-09T10:00:00.000Z',
    spaceId: '11111111-1111-1111-1111-111111111111',
  },
]

describe('resolveLayoutInboxItems', () => {
  it('returns [] when the overlay is not given items — layout SSR must not fetch', () => {
    expect(resolveLayoutInboxItems(undefined)).toEqual([])
  })

  it('passes through the /inbox page’s already-fetched items', () => {
    expect(resolveLayoutInboxItems(SAMPLE)).toEqual(SAMPLE)
  })
})

describe('navPrefetchStrategy', () => {
  it('hover-prefetches in-app hrefs (not viewport — that SSRs every visible link)', () => {
    expect(navPrefetchStrategy('/backups')).toBe('hover')
    expect(navPrefetchStrategy('/data')).toBe('hover')
  })

  it('skips non-app hrefs', () => {
    expect(navPrefetchStrategy('https://example.com')).toBeUndefined()
    expect(navPrefetchStrategy(undefined)).toBeUndefined()
  })
})

describe('inbox chrome cache', () => {
  it('returns a live entry and misses once TTL elapses', () => {
    clearInboxCache()
    const t0 = 1_000_000
    writeInboxCache('org-1', SAMPLE, t0)
    expect(readInboxCache('org-1', t0 + 1)).toEqual(SAMPLE)
    expect(readInboxCache('org-1', t0 + INBOX_CACHE_TTL_MS + 1)).toBeNull()
    expect(readInboxCache('missing', t0)).toBeNull()
  })
})

describe('connection-health chrome cache', () => {
  it('does not block layout SSR — cache is optional and TTL-bound', async () => {
    const {
      readConnectionHealthCache,
      writeConnectionHealthCache,
      clearConnectionHealthCache,
    } = await import('./shell-chrome')
    clearConnectionHealthCache()
    const t0 = 2_000_000
    const value = { connections: [{ status: 'active', displayName: 'Airtable' }] }
    writeConnectionHealthCache('org-1', value, t0)
    expect(readConnectionHealthCache('org-1', t0 + 1)).toEqual(value)
    expect(readConnectionHealthCache('org-1', t0 + INBOX_CACHE_TTL_MS + 1)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  applyNavSnapshotHeaders,
  NAV_SNAPSHOT_CACHE_CONTROL,
  shouldApplyNavSnapshot,
} from './nav-snapshot'

describe('shouldApplyNavSnapshot', () => {
  const ok = {
    method: 'GET',
    pathname: '/data',
    status: 200,
    hasSetCookie: false,
    existingCacheControl: null,
  }

  it('allows authenticated app pages and server islands', () => {
    expect(shouldApplyNavSnapshot(ok)).toBe(true)
    expect(shouldApplyNavSnapshot({ ...ok, pathname: '/' })).toBe(true)
    expect(shouldApplyNavSnapshot({ ...ok, pathname: '/_server-islands/DataBody' })).toBe(true)
  })

  it('skips APIs, auth pages, mutations, errors, and Set-Cookie', () => {
    expect(shouldApplyNavSnapshot({ ...ok, pathname: '/api/spaces/x' })).toBe(false)
    expect(shouldApplyNavSnapshot({ ...ok, pathname: '/login' })).toBe(false)
    expect(shouldApplyNavSnapshot({ ...ok, method: 'POST' })).toBe(false)
    expect(shouldApplyNavSnapshot({ ...ok, status: 302 })).toBe(false)
    expect(shouldApplyNavSnapshot({ ...ok, hasSetCookie: true })).toBe(false)
    expect(shouldApplyNavSnapshot({ ...ok, existingCacheControl: 'no-store' })).toBe(false)
  })
})

describe('applyNavSnapshotHeaders', () => {
  it('sets private max-age on a 200 HTML response', () => {
    const res = applyNavSnapshotHeaders(new Response('ok', { status: 200 }), {
      method: 'GET',
      pathname: '/schema',
    })
    expect(res.headers.get('Cache-Control')).toBe(NAV_SNAPSHOT_CACHE_CONTROL)
    expect(res.headers.get('Vary')).toBe('Cookie')
  })
})

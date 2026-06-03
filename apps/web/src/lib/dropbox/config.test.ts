import { describe, it, expect } from 'vitest'
import { getRedirectUri } from './config'

describe('getRedirectUri', () => {
  it('derives the redirect URI from origin when no env override is set', () => {
    expect(getRedirectUri('https://baseout.dev')).toBe(
      'https://baseout.dev/api/connections/storage/dropbox/callback',
    )
  })

  it('strips a trailing slash on origin', () => {
    expect(getRedirectUri('https://baseout.dev/')).toBe(
      'https://baseout.dev/api/connections/storage/dropbox/callback',
    )
  })

  it('returns env.DROPBOX_REDIRECT_URI verbatim when set, ignoring origin', () => {
    // This is the load-bearing case for `wrangler dev --remote`: the worker
    // code sees its hostname as the deployed preview URL even though the
    // browser is on baseout.local. Pinning the redirect URI to a registered
    // hostname keeps the OAuth flow consistent.
    const env = {
      DROPBOX_REDIRECT_URI:
        'https://baseout.local:4331/api/connections/storage/dropbox/callback',
    }
    expect(
      getRedirectUri('https://baseout-dev.openside.workers.dev', env),
    ).toBe('https://baseout.local:4331/api/connections/storage/dropbox/callback')
  })

  it('falls back to origin when env is provided but DROPBOX_REDIRECT_URI is undefined', () => {
    expect(getRedirectUri('https://baseout.dev', {})).toBe(
      'https://baseout.dev/api/connections/storage/dropbox/callback',
    )
  })

  it('falls back to origin when env is provided but DROPBOX_REDIRECT_URI is empty string', () => {
    expect(getRedirectUri('https://baseout.dev', { DROPBOX_REDIRECT_URI: '' })).toBe(
      'https://baseout.dev/api/connections/storage/dropbox/callback',
    )
  })
})

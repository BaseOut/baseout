/**
 * Airtable SSO provider tests (web-auth-airtable-sso tasks 2.1/2.3).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  AIRTABLE_LOGIN_SCOPES,
  buildAirtableSsoProvider,
  isAirtableSsoConfigured,
  mapWhoamiToUserInfo,
} from './sso'
import {
  AIRTABLE_AUTHORIZE_URL,
  AIRTABLE_TOKEN_URL,
  resolveAirtableUrls,
} from './config'
import { createAuth } from '../auth-factory'

const CREDS = { clientId: 'login-app-id', clientSecret: 'login-app-secret' }

describe('isAirtableSsoConfigured', () => {
  it('requires BOTH login-app vars', () => {
    expect(isAirtableSsoConfigured({})).toBe(false)
    expect(
      isAirtableSsoConfigured({ AIRTABLE_LOGIN_OAUTH_CLIENT_ID: 'x' }),
    ).toBe(false)
    expect(
      isAirtableSsoConfigured({
        AIRTABLE_LOGIN_OAUTH_CLIENT_ID: 'x',
        AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET: 'y',
      }),
    ).toBe(true)
  })
})

describe('mapWhoamiToUserInfo', () => {
  it('maps id + verified email; name defaults to the local part', () => {
    expect(
      mapWhoamiToUserInfo({ id: 'usrX', email: 'Person@Acme.com' }),
    ).toEqual({
      id: 'usrX',
      email: 'person@acme.com',
      emailVerified: true,
      name: 'person',
    })
  })

  it('returns null on missing email or id (→ login-page error, no partial state)', () => {
    expect(mapWhoamiToUserInfo({ id: 'usrX' })).toBeNull()
    expect(mapWhoamiToUserInfo({ email: 'a@b.com' })).toBeNull()
    expect(mapWhoamiToUserInfo(null)).toBeNull()
  })
})

describe('buildAirtableSsoProvider', () => {
  it('is a minimal-consent PKCE provider on the real Airtable endpoints', () => {
    const provider = buildAirtableSsoProvider(CREDS)
    expect(provider.providerId).toBe('airtable')
    expect(provider.scopes).toEqual([...AIRTABLE_LOGIN_SCOPES])
    expect(provider.scopes).toEqual(['user.email:read', 'schema.bases:read'])
    expect(provider.pkce).toBe(true)
    expect(provider.authorizationUrl).toBe(AIRTABLE_AUTHORIZE_URL)
    expect(provider.tokenUrl).toBe(AIRTABLE_TOKEN_URL)
    expect(provider.authentication).toBe('basic')
  })

  it('getUserInfo calls whoami ONLY and maps the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'usr1', email: 'p@acme.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const provider = buildAirtableSsoProvider(CREDS, fetchImpl as typeof fetch)
    const info = await provider.getUserInfo!({
      accessToken: 'tok',
    } as never)
    expect(info).toMatchObject({ id: 'usr1', email: 'p@acme.com', emailVerified: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('https://api.airtable.com/v0/meta/whoami')
    expect((init as RequestInit).headers).toMatchObject({
      authorization: 'Bearer tok',
    })
  })

  it('whoami failure or missing token → null (no partial state)', async () => {
    const failing = buildAirtableSsoProvider(
      CREDS,
      vi.fn().mockResolvedValue(new Response('nope', { status: 500 })) as typeof fetch,
    )
    expect(await failing.getUserInfo!({ accessToken: 'tok' } as never)).toBeNull()

    const throwing = buildAirtableSsoProvider(
      CREDS,
      vi.fn().mockRejectedValue(new Error('network')) as typeof fetch,
    )
    expect(await throwing.getUserInfo!({ accessToken: 'tok' } as never)).toBeNull()

    const provider = buildAirtableSsoProvider(CREDS, vi.fn() as typeof fetch)
    expect(await provider.getUserInfo!({} as never)).toBeNull()
  })
})

describe('createAuth — conditional SSO registration', () => {
  function build(extra: Record<string, string | undefined> = {}) {
    return createAuth({} as never, {
      secret: 'test-secret',
      email: undefined,
      from: undefined,
      dev: false,
      baseUrl: 'https://baseout.dev',
      airtableLoginClientId: extra.id,
      airtableLoginClientSecret: extra.secret,
    })
  }
  function pluginIds(auth: ReturnType<typeof build>) {
    return ((auth.options as { plugins?: Array<{ id: string }> }).plugins ?? []).map(
      (p) => p.id,
    )
  }

  it('absent vars ⇒ no generic-oauth plugin (SSO hidden, zero behavior change)', () => {
    expect(pluginIds(build())).not.toContain('generic-oauth')
  })

  it('both vars ⇒ generic-oauth registered with sign-in endpoint', () => {
    const auth = build({ id: 'x', secret: 'y' })
    expect(pluginIds(auth)).toContain('generic-oauth')
    expect(
      typeof (auth.api as Record<string, unknown>).signInWithOAuth2,
    ).toBe('function')
  })

  it('stub mode ⇒ generic-oauth registered WITHOUT creds (local smoke path)', () => {
    const auth = createAuth({} as never, {
      secret: 'test-secret',
      email: undefined,
      from: undefined,
      dev: false,
      baseUrl: 'https://baseout.local:4331',
      airtableStubsEnabled: true,
    })
    expect(pluginIds(auth)).toContain('generic-oauth')
  })
})

describe('buildAirtableSsoProvider — stub-mode URLs', () => {
  const STUB_URLS = resolveAirtableUrls(
    { AIRTABLE_STUBS_ENABLED: '1' },
    'https://baseout.local:4331',
  )

  it('accepts resolved stub URLs for authorize/token', () => {
    const provider = buildAirtableSsoProvider(
      CREDS,
      fetch,
      STUB_URLS,
    )
    expect(provider.authorizationUrl).toBe(
      'https://baseout.local:4331/api/stub/airtable/authorize',
    )
    expect(provider.tokenUrl).toBe(
      'https://baseout.local:4331/api/stub/airtable/token',
    )
  })

  it('getUserInfo hits the stub whoami when stub URLs are supplied', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'usrSTUB1', email: 'stub@baseout.dev' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const provider = buildAirtableSsoProvider(
      CREDS,
      fetchImpl as typeof fetch,
      STUB_URLS,
    )
    const info = await provider.getUserInfo!({ accessToken: 'tok' } as never)
    expect(info).toMatchObject({ id: 'usrSTUB1', email: 'stub@baseout.dev' })
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://baseout.local:4331/api/stub/airtable/v0/meta/whoami',
    )
  })
})

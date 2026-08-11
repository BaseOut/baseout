import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  generateState,
  refreshAccessToken,
} from './oauth'
import { DROPBOX_AUTHORIZE_URL, DROPBOX_TOKEN_URL } from './config'

describe('generatePkcePair', () => {
  it('returns a verifier between 43 and 128 chars', async () => {
    const { verifier } = await generatePkcePair()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
  })

  it('produces a verifier that is url-safe base64 (no padding)', async () => {
    const { verifier } = await generatePkcePair()
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('produces an S256 challenge of 43 chars', async () => {
    const { challenge } = await generatePkcePair()
    expect(challenge.length).toBe(43)
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('returns a different verifier on each call', async () => {
    const a = await generatePkcePair()
    const b = await generatePkcePair()
    expect(a.verifier).not.toBe(b.verifier)
  })
})

describe('generateState', () => {
  it('returns url-safe base64 of 32 bytes', () => {
    const state = generateState()
    expect(state.length).toBe(43)
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/)
  })
})

describe('buildAuthorizeUrl', () => {
  it('builds the Dropbox authorize URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'app_key_abc',
      redirectUri: 'https://app.example.com/cb',
      state: 'state_xyz',
      challenge: 'challenge_abc',
    })
    expect(url.startsWith(DROPBOX_AUTHORIZE_URL + '?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('client_id')).toBe('app_key_abc')
    expect(params.get('redirect_uri')).toBe('https://app.example.com/cb')
    expect(params.get('response_type')).toBe('code')
    expect(params.get('state')).toBe('state_xyz')
    expect(params.get('code_challenge')).toBe('challenge_abc')
    expect(params.get('code_challenge_method')).toBe('S256')
  })

  it('sets token_access_type=offline (required to get a refresh_token from Dropbox)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
      challenge: 'ch',
    })
    expect(new URL(url).searchParams.get('token_access_type')).toBe('offline')
  })

  it('does NOT set scope on the authorize URL (Dropbox honors App Console Permissions tab)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
      challenge: 'ch',
    })
    expect(new URL(url).searchParams.get('scope')).toBeNull()
  })

  it('does NOT set Google-style access_type or prompt params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
      challenge: 'ch',
    })
    const params = new URL(url).searchParams
    expect(params.get('access_type')).toBeNull()
    expect(params.get('prompt')).toBeNull()
  })

  it('honors an authorizeUrl override (for fixtures)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
      challenge: 'ch',
      authorizeUrl: 'https://fake-dropbox.test/authorize',
    })
    expect(url.startsWith('https://fake-dropbox.test/authorize?')).toBe(true)
  })
})

describe('exchangeCodeForTokens', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('POSTs form-encoded body with grant_type=authorization_code, code, verifier, redirect_uri, client_id, client_secret', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'sl.u.AbX9_at_initial',
          refresh_token: 'rt_initial',
          expires_in: 14400,
          token_type: 'bearer',
          scope: 'files.content.write files.metadata.write',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const result = await exchangeCodeForTokens({
      code: 'code_123',
      verifier: 'verifier_xyz',
      clientId: 'app_key_abc',
      clientSecret: 'app_secret_abc',
      redirectUri: 'https://app.example.com/cb',
    })

    expect(result).toEqual({
      accessToken: 'sl.u.AbX9_at_initial',
      refreshToken: 'rt_initial',
      expiresIn: 14400,
      scope: 'files.content.write files.metadata.write',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(DROPBOX_TOKEN_URL)
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    )
    // We use body-form auth (parity with Drive + Box) — no Authorization header.
    expect(headers.get('authorization')).toBeNull()

    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code_123')
    expect(body.get('code_verifier')).toBe('verifier_xyz')
    expect(body.get('redirect_uri')).toBe('https://app.example.com/cb')
    expect(body.get('client_id')).toBe('app_key_abc')
    expect(body.get('client_secret')).toBe('app_secret_abc')
  })

  it('throws with the Dropbox error payload when the token request fails', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'code expired',
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    )

    await expect(
      exchangeCodeForTokens({
        code: 'bad',
        verifier: 'v',
        clientId: 'c',
        clientSecret: 's',
        redirectUri: 'r',
      }),
    ).rejects.toThrow(/invalid_grant/)
  })
})

describe('refreshAccessToken', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('POSTs grant_type=refresh_token + body-form auth and returns refreshToken: null (Dropbox omits refresh_token on refresh)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'sl.u.at_refreshed',
          expires_in: 14400,
          token_type: 'bearer',
          scope: 'files.content.write files.metadata.write',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const result = await refreshAccessToken({
      refreshToken: 'rt_initial',
      clientId: 'c',
      clientSecret: 's',
    })

    expect(result.accessToken).toBe('sl.u.at_refreshed')
    expect(result.expiresIn).toBe(14400)
    // Dropbox does NOT return a new refresh_token on refresh — refresh tokens
    // are long-lived and stable. Callers preserve the previously stored value.
    expect(result.refreshToken).toBeNull()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('rt_initial')
    expect(body.get('client_id')).toBe('c')
    expect(body.get('client_secret')).toBe('s')
  })

  it('throws on Dropbox invalid_grant (refresh token revoked or app permission revoked)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'refresh token revoked',
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    )

    await expect(
      refreshAccessToken({
        refreshToken: 'rt_old',
        clientId: 'c',
        clientSecret: 's',
      }),
    ).rejects.toThrow(/invalid_grant/)
  })

  it('throws on unparseable body / network error', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response('not json', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      }),
    )
    await expect(
      refreshAccessToken({
        refreshToken: 'rt_old',
        clientId: 'c',
        clientSecret: 's',
      }),
    ).rejects.toThrow(/Dropbox token exchange failed/)
  })
})

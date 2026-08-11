import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  generateState,
  refreshAccessToken,
} from './oauth'
import { BOX_AUTHORIZE_URL, BOX_TOKEN_URL } from './config'

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
  it('builds the Box authorize URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'client_abc',
      redirectUri: 'https://app.example.com/cb',
      state: 'state_xyz',
      challenge: 'challenge_abc',
    })
    expect(url.startsWith(BOX_AUTHORIZE_URL + '?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('client_id')).toBe('client_abc')
    expect(params.get('redirect_uri')).toBe('https://app.example.com/cb')
    expect(params.get('response_type')).toBe('code')
    expect(params.get('state')).toBe('state_xyz')
    expect(params.get('code_challenge')).toBe('challenge_abc')
    expect(params.get('code_challenge_method')).toBe('S256')
  })

  it('does NOT set Drive-specific access_type or prompt params (Box ignores them)', () => {
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

  it('does NOT set scope (Box honors Application Scopes from the App config)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
      challenge: 'ch',
    })
    expect(new URL(url).searchParams.get('scope')).toBeNull()
  })

  it('honors an authorizeUrl override (for fixtures / staging Box)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
      challenge: 'ch',
      authorizeUrl: 'https://fake-box.test/authorize',
    })
    expect(url.startsWith('https://fake-box.test/authorize?')).toBe(true)
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
          access_token: 'at_abc',
          refresh_token: 'rt_abc',
          expires_in: 3600,
          token_type: 'bearer',
          scope: 'root_readwrite',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const result = await exchangeCodeForTokens({
      code: 'code_123',
      verifier: 'verifier_xyz',
      clientId: 'client_abc',
      clientSecret: 'secret_abc',
      redirectUri: 'https://app.example.com/cb',
    })

    expect(result).toEqual({
      accessToken: 'at_abc',
      refreshToken: 'rt_abc',
      expiresIn: 3600,
      scope: 'root_readwrite',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(BOX_TOKEN_URL)
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    )
    // Box accepts both basic-auth and body-form. We use body-form for parity
    // with Drive — keeps secrets out of an Authorization header.
    expect(headers.get('authorization')).toBeNull()

    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code_123')
    expect(body.get('code_verifier')).toBe('verifier_xyz')
    expect(body.get('redirect_uri')).toBe('https://app.example.com/cb')
    expect(body.get('client_id')).toBe('client_abc')
    expect(body.get('client_secret')).toBe('secret_abc')
  })

  it('throws with the Box error payload when the token request fails', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Refresh token has expired',
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

  it('POSTs grant_type=refresh_token + body-form auth and returns the NEW rotated refresh_token', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at_new',
          refresh_token: 'rt_NEW_rotated',
          expires_in: 3600,
          token_type: 'bearer',
          scope: 'root_readwrite',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const result = await refreshAccessToken({
      refreshToken: 'rt_old',
      clientId: 'c',
      clientSecret: 's',
    })

    expect(result.accessToken).toBe('at_new')
    expect(result.expiresIn).toBe(3600)
    // Box ROTATES the refresh token on every refresh. Verifying the new
    // value is surfaced is the load-bearing assertion — callers MUST
    // persist it or the next refresh fails with invalid_grant.
    expect(result.refreshToken).toBe('rt_NEW_rotated')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('rt_old')
    expect(body.get('client_id')).toBe('c')
    expect(body.get('client_secret')).toBe('s')
  })

  it('throws on Box invalid_grant (refresh token expired after 60 idle days, or already-rotated)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Refresh token has expired',
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

  it('throws on network error / unparseable body', async () => {
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
    ).rejects.toThrow(/Box token exchange failed/)
  })
})

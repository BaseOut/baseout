import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  generateState,
  refreshAccessToken,
} from './oauth'
import { GOOGLE_AUTHORIZE_URL, GOOGLE_TOKEN_URL } from './config'

describe('generatePkcePair', () => {
  it('returns a verifier between 43 and 128 chars, url-safe base64', async () => {
    const { verifier } = await generatePkcePair()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('produces an S256 challenge of 43 chars', async () => {
    const { challenge } = await generatePkcePair()
    expect(challenge.length).toBe(43)
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('derives challenge deterministically from verifier via sha256', async () => {
    const pair = await generatePkcePair()
    const encoder = new TextEncoder()
    const digest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(pair.verifier),
    )
    const b64 = Buffer.from(new Uint8Array(digest))
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
    expect(pair.challenge).toBe(b64)
  })
})

describe('generateState', () => {
  it('returns url-safe base64 of 32 bytes (43 chars, no padding)', () => {
    const state = generateState()
    expect(state.length).toBe(43)
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/)
  })
})

describe('buildAuthorizeUrl', () => {
  it('builds the Google authorize URL with all required params + refresh-token modifiers', () => {
    const url = buildAuthorizeUrl({
      clientId: 'client_abc',
      redirectUri: 'https://localhost:4331/oauth/callback/google',
      scopes: [
        'profile',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.appdata',
      ],
      state: 'state_xyz',
      challenge: 'challenge_abc',
    })
    expect(url.startsWith(GOOGLE_AUTHORIZE_URL + '?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('client_id')).toBe('client_abc')
    expect(params.get('redirect_uri')).toBe(
      'https://localhost:4331/oauth/callback/google',
    )
    expect(params.get('response_type')).toBe('code')
    expect(params.get('scope')).toBe(
      'profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
    )
    expect(params.get('state')).toBe('state_xyz')
    expect(params.get('code_challenge')).toBe('challenge_abc')
    expect(params.get('code_challenge_method')).toBe('S256')
    // The refresh-token modifiers — without these, Google omits refresh_token
    // on every authorize after the first.
    expect(params.get('access_type')).toBe('offline')
    expect(params.get('prompt')).toBe('consent')
    expect(params.get('include_granted_scopes')).toBe('true')
  })

  it('honors the authorizeUrl override (for tests that mock the endpoint)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'r',
      scopes: ['s'],
      state: 'st',
      challenge: 'ch',
      authorizeUrl: 'https://stub.example.com/auth',
    })
    expect(url.startsWith('https://stub.example.com/auth?')).toBe(true)
  })
})

describe('exchangeCodeForTokens', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    fetchSpy.mockReset()
  })
  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('POSTs form-encoded body to the Google token URL with client creds and PKCE verifier', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at_123',
          refresh_token: 'rt_456',
          expires_in: 3600,
          scope: 'profile',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const tokens = await exchangeCodeForTokens({
      code: 'code_abc',
      verifier: 'verifier_xyz',
      clientId: 'client_id_value',
      clientSecret: 'client_secret_value',
      redirectUri: 'https://localhost:4331/oauth/callback/google',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(GOOGLE_TOKEN_URL)
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code_abc')
    expect(body.get('code_verifier')).toBe('verifier_xyz')
    expect(body.get('client_id')).toBe('client_id_value')
    expect(body.get('client_secret')).toBe('client_secret_value')
    expect(body.get('redirect_uri')).toBe(
      'https://localhost:4331/oauth/callback/google',
    )
    expect(tokens).toEqual({
      accessToken: 'at_123',
      refreshToken: 'rt_456',
      expiresIn: 3600,
      scope: 'profile',
    })
  })

  it('throws a typed error when the token endpoint returns a non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'auth code expired',
        }),
        { status: 400 },
      ),
    )
    await expect(
      exchangeCodeForTokens({
        code: 'c',
        verifier: 'v',
        clientId: 'i',
        clientSecret: 's',
        redirectUri: 'r',
      }),
    ).rejects.toThrow(/invalid_grant/)
  })
})

describe('refreshAccessToken', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    fetchSpy.mockReset()
  })
  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('POSTs the refresh_token grant with client creds', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at_new',
          expires_in: 3600,
          scope: 'profile',
        }),
        { status: 200 },
      ),
    )
    const tokens = await refreshAccessToken({
      refreshToken: 'rt_xyz',
      clientId: 'i',
      clientSecret: 's',
    })
    expect(tokens.accessToken).toBe('at_new')
    expect(tokens.refreshToken).toBeNull()
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('rt_xyz')
    expect(body.get('client_id')).toBe('i')
    expect(body.get('client_secret')).toBe('s')
  })
})

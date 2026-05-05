import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  generateState,
  refreshAccessToken,
} from './oauth'
import { AIRTABLE_AUTHORIZE_URL, AIRTABLE_TOKEN_URL } from './config'

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

  it('produces an S256 challenge of 43 chars (url-safe base64 of 32-byte sha256)', async () => {
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

  it('returns a different verifier on each call', async () => {
    const a = await generatePkcePair()
    const b = await generatePkcePair()
    expect(a.verifier).not.toBe(b.verifier)
  })
})

describe('generateState', () => {
  it('returns url-safe base64 of 32 bytes (43 chars, no padding)', () => {
    const state = generateState()
    expect(state.length).toBe(43)
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('returns a different state on each call', () => {
    expect(generateState()).not.toBe(generateState())
  })
})

describe('buildAuthorizeUrl', () => {
  it('builds the Airtable authorize URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'client_abc',
      redirectUri: 'https://app.example.com/cb',
      scopes: ['data.records:read', 'schema.bases:read'],
      state: 'state_xyz',
      challenge: 'challenge_abc',
    })
    expect(url.startsWith(AIRTABLE_AUTHORIZE_URL + '?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('client_id')).toBe('client_abc')
    expect(params.get('redirect_uri')).toBe('https://app.example.com/cb')
    expect(params.get('response_type')).toBe('code')
    expect(params.get('scope')).toBe('data.records:read schema.bases:read')
    expect(params.get('state')).toBe('state_xyz')
    expect(params.get('code_challenge')).toBe('challenge_abc')
    expect(params.get('code_challenge_method')).toBe('S256')
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

  it('POSTs to the token URL with grant_type=authorization_code, code, verifier, and redirect_uri; uses HTTP Basic auth', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at_abc',
          refresh_token: 'rt_abc',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'data.records:read schema.bases:read',
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
      scope: 'data.records:read schema.bases:read',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(AIRTABLE_TOKEN_URL)
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    )
    const expectedBasic =
      'Basic ' + Buffer.from('client_abc:secret_abc').toString('base64')
    expect(headers.get('authorization')).toBe(expectedBasic)

    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code_123')
    expect(body.get('code_verifier')).toBe('verifier_xyz')
    expect(body.get('redirect_uri')).toBe('https://app.example.com/cb')
  })

  it('throws with the Airtable error payload when the token request fails', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'nope' }),
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

  it('POSTs grant_type=refresh_token and returns the new tokens', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at_new',
          refresh_token: 'rt_new',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'data.records:read',
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
    expect(result.refreshToken).toBe('rt_new')
    expect(result.expiresIn).toBe(3600)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('rt_old')
  })
})

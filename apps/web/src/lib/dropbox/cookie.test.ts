import { describe, it, expect } from 'vitest'
import {
  DROPBOX_OAUTH_COOKIE,
  buildClearCookie,
  buildSetCookie,
  openHandoffPayload,
  readHandoffCookie,
  sealHandoffPayload,
} from './cookie'

const TEST_KEY = Buffer.alloc(32, 7).toString('base64')

describe('sealHandoffPayload / openHandoffPayload', () => {
  it('round-trips a payload through encryption', async () => {
    const payload = {
      verifier: 'v',
      state: 's',
      spaceId: 'sp',
      userId: 'u',
      redirectUri: 'https://example.com/cb',
    }
    const sealed = await sealHandoffPayload(payload, TEST_KEY)
    expect(sealed).not.toContain('verifier')
    const opened = await openHandoffPayload(sealed, TEST_KEY)
    expect(opened).toEqual(payload)
  })

  it('round-trips an optional returnTo field', async () => {
    const payload = {
      verifier: 'v',
      state: 's',
      spaceId: 'sp',
      userId: 'u',
      redirectUri: 'https://example.com/cb',
      returnTo: '/backups',
    }
    const sealed = await sealHandoffPayload(payload, TEST_KEY)
    const opened = await openHandoffPayload(sealed, TEST_KEY)
    expect(opened.returnTo).toBe('/backups')
  })

  it('rejects a tampered ciphertext', async () => {
    const sealed = await sealHandoffPayload(
      {
        verifier: 'v',
        state: 's',
        spaceId: 'sp',
        userId: 'u',
        redirectUri: 'r',
      },
      TEST_KEY,
    )
    const bytes = Buffer.from(sealed, 'base64')
    bytes[bytes.length - 1] ^= 0xff
    const tampered = bytes.toString('base64')
    await expect(openHandoffPayload(tampered, TEST_KEY)).rejects.toThrow()
  })

  it('rejects a payload missing required fields', async () => {
    const { encryptToken } = await import('../crypto')
    const bogus = await encryptToken(
      JSON.stringify({ verifier: 'only' }),
      TEST_KEY,
    )
    await expect(openHandoffPayload(bogus, TEST_KEY)).rejects.toThrow(
      /malformed/i,
    )
  })
})

describe('buildSetCookie', () => {
  it('sets HttpOnly, SameSite=Lax, scoped path, Secure by default', () => {
    const header = buildSetCookie('abc', { secure: true, maxAgeSeconds: 600 })
    expect(header).toContain(`${DROPBOX_OAUTH_COOKIE}=abc`)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Path=/api/connections/storage/dropbox')
    expect(header).toContain('Secure')
    expect(header).toContain('Max-Age=600')
  })

  it('omits Secure on localhost dev', () => {
    const header = buildSetCookie('abc', { secure: false, maxAgeSeconds: 600 })
    expect(header).not.toContain('Secure')
  })

  it('uses the Dropbox-specific cookie name, distinct from Drive + Box', () => {
    const header = buildSetCookie('abc', { secure: true })
    expect(header).toContain('bo_oauth_dropbox=abc')
    expect(header).not.toContain('bo_oauth_box')
    expect(header).not.toContain('bo_oauth_google_drive')
  })
})

describe('buildClearCookie', () => {
  it('sets Max-Age=0', () => {
    expect(buildClearCookie({ secure: true })).toContain('Max-Age=0')
  })
})

describe('readHandoffCookie', () => {
  it('extracts the cookie value', () => {
    const header = `foo=bar; ${DROPBOX_OAUTH_COOKIE}=myvalue; baz=qux`
    expect(readHandoffCookie(header)).toBe('myvalue')
  })

  it('does NOT match the Box or Drive cookies (avoids cross-provider leakage)', () => {
    expect(readHandoffCookie('bo_oauth_box=boxvalue')).toBeNull()
    expect(readHandoffCookie('bo_oauth_google_drive=drivevalue')).toBeNull()
  })

  it('returns null when missing', () => {
    expect(readHandoffCookie('foo=bar')).toBeNull()
    expect(readHandoffCookie(null)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { openHandoffToken } from './handoff'
import { encryptToken, generateEncryptionKey } from './crypto'

const ORIGIN = 'https://baseout-admin-dev.openside.workers.dev'
const SECRET = generateEncryptionKey()
const NOW = new Date('2026-07-13T12:00:00Z')

async function seal(payload: unknown, secret = SECRET): Promise<string> {
  return encryptToken(JSON.stringify(payload), secret)
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    st: 'tok123.sig456',
    aud: ORIGIN,
    exp: NOW.getTime() + 60_000,
    ...overrides,
  }
}

describe('openHandoffToken', () => {
  it('opens a valid token and returns the session-cookie value', async () => {
    const result = await openHandoffToken(await seal(validPayload()), SECRET, ORIGIN, NOW)
    expect(result).toEqual({ ok: true, sessionCookieValue: 'tok123.sig456' })
  })

  it('rejects a token sealed with a different secret', async () => {
    const other = generateEncryptionKey()
    const result = await openHandoffToken(await seal(validPayload(), other), SECRET, ORIGIN, NOW)
    expect(result).toEqual({ ok: false, reason: 'undecryptable' })
  })

  it('rejects garbage input', async () => {
    const result = await openHandoffToken('not-a-token', SECRET, ORIGIN, NOW)
    expect(result).toEqual({ ok: false, reason: 'undecryptable' })
  })

  it('rejects an expired token (and exactly-now counts as expired)', async () => {
    const atNow = await seal(validPayload({ exp: NOW.getTime() }))
    expect(await openHandoffToken(atNow, SECRET, ORIGIN, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('rejects a token minted for a different origin', async () => {
    const token = await seal(validPayload({ aud: 'https://other.example.com' }))
    expect(await openHandoffToken(token, SECRET, ORIGIN, NOW)).toEqual({
      ok: false,
      reason: 'wrong-audience',
    })
  })

  it('rejects malformed payloads (wrong version, missing/empty st, non-JSON)', async () => {
    expect(
      await openHandoffToken(await seal(validPayload({ v: 2 })), SECRET, ORIGIN, NOW),
    ).toEqual({ ok: false, reason: 'malformed' })
    expect(
      await openHandoffToken(await seal(validPayload({ st: '' })), SECRET, ORIGIN, NOW),
    ).toEqual({ ok: false, reason: 'malformed' })
    expect(
      await openHandoffToken(await encryptToken('not json', SECRET), SECRET, ORIGIN, NOW),
    ).toEqual({ ok: false, reason: 'malformed' })
  })
})

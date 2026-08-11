/**
 * Auth-event audit sinks (SOC 2 CC7.2). Mirrors the repo boundary: the thin
 * write wrappers are unit-tested here with an injected fake db; the auth-factory
 * hook wiring is exercised through the auth flow itself.
 */

import { describe, expect, it } from 'vitest'
import type { AppDb } from '../db'
import { handleMagicLinkRequested, handleSessionCreated } from './auth-events'

function fakeDb() {
  const rows: Array<Record<string, unknown>> = []
  const db = {
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        rows.push(v)
      },
    }),
  } as unknown as AppDb
  return { db, rows }
}

describe('handleMagicLinkRequested', () => {
  it('records a magic_link_requested row keyed on the email', async () => {
    const { db, rows } = fakeDb()
    await handleMagicLinkRequested(db, { email: 'user@example.com' })
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('magic_link_requested')
    expect(rows[0].actorEmail).toBe('user@example.com')
  })

  it('never logs the magic-link URL or a token (schema no-secrets rule)', async () => {
    const { db, rows } = fakeDb()
    await handleMagicLinkRequested(db, { email: 'user@example.com' })
    expect(JSON.stringify(rows[0])).not.toMatch(/token|https?:\/\//i)
  })
})

describe('handleSessionCreated', () => {
  it('records a session_created row with userId + non-secret request context', async () => {
    const { db, rows } = fakeDb()
    await handleSessionCreated(db, {
      userId: 'usr_1',
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
    })
    expect(rows[0].kind).toBe('session_created')
    expect(rows[0].actorUserId).toBe('usr_1')
    expect(rows[0].metadata).toEqual({ ip: '203.0.113.7', userAgent: 'Mozilla/5.0' })
  })

  it('tolerates missing IP / user agent', async () => {
    const { db, rows } = fakeDb()
    await handleSessionCreated(db, { userId: 'usr_1' })
    expect(rows[0].metadata).toEqual({ ip: null, userAgent: null })
  })

  it('is best-effort: a db failure never throws (login must not break)', async () => {
    const db = {
      insert: () => ({
        values: async () => {
          throw new Error('db down')
        },
      }),
    } as unknown as AppDb
    await expect(
      handleSessionCreated(db, { userId: 'usr_1' }),
    ).resolves.toBeUndefined()
  })
})

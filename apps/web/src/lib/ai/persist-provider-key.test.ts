/**
 * shared-ai-byok task 1.2 — the encrypted BYOK write path.
 *
 * Mirrors apps/web/src/lib/airtable/persist(-workspace).test.ts: the pure
 * metadata derivation is asserted directly, and the upsert shape is exercised
 * against a light capturing fake-db (the resolve.test.ts makeFakeDb idiom) so
 * we verify the encrypt-before-write discipline with no real Postgres.
 *
 * The load-bearing security assertions (design.md → Security review points #1/#2):
 * the plaintext key is NEVER returned by the function and NEVER present in the
 * row that gets persisted (only ciphertext + fingerprint + last_four).
 */

import { describe, expect, it } from 'vitest'
import type { AppDb } from '../../db'
import { generateEncryptionKey, decryptToken } from '../crypto'
import { deriveKeyMetadata, persistProviderKey } from './persist-provider-key'

const PLAINTEXT = 'sk-ant-api03-SUPERSECRETVALUE-abcd1234WXYZ'

// Capturing fake: records the values handed to insert()/update() and lets the
// caller preset the "existing active row" lookup result so both branches run.
function makeCapturingDb(existingRows: unknown[]) {
  const captured: { insert?: Record<string, unknown>; update?: Record<string, unknown> } = {}
  const selectChain: Record<string, unknown> = {}
  const passthrough = () => selectChain
  selectChain.from = passthrough
  selectChain.where = passthrough
  selectChain.orderBy = passthrough
  selectChain.limit = () => Promise.resolve(existingRows)
  const db = {
    select: () => selectChain,
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        captured.insert = v
        return { returning: () => Promise.resolve([{ id: 'aik_test_1' }]) }
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        captured.update = v
        return { where: () => Promise.resolve() }
      },
    }),
  }
  return { db: db as unknown as AppDb, captured }
}

describe('deriveKeyMetadata', () => {
  it('computes a SHA-256 hex fingerprint + last_four, never echoing the key', async () => {
    const meta = await deriveKeyMetadata(PLAINTEXT)
    // SHA-256 of the exact plaintext, hex-encoded (64 chars). Precomputed via
    // the platform WebCrypto so the test pins the value, not the algorithm.
    const expected = await sha256HexRef(PLAINTEXT)
    expect(meta.keyFingerprint).toBe(expected)
    expect(meta.keyFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(meta.lastFour).toBe('WXYZ')
    // fingerprint is irreversible — must not contain the plaintext
    expect(meta.keyFingerprint).not.toContain(PLAINTEXT)
  })
})

describe('persistProviderKey', () => {
  it('INSERTS an active row when none exists: encrypts, stores fingerprint + last_four', async () => {
    const key = generateEncryptionKey()
    const { db, captured } = makeCapturingDb([]) // no existing active row
    const result = await persistProviderKey(db, key, {
      organizationId: 'org_1',
      provider: 'anthropic',
      plaintextKey: PLAINTEXT,
      label: 'Prod Anthropic',
      modelDefault: 'claude-opus-4-8',
      createdByUserId: 'user_1',
    })

    const row = captured.insert!
    // ciphertext, not plaintext — and it round-trips back to the original key
    expect(row.keyEnc).toBeTypeOf('string')
    expect(row.keyEnc).not.toBe(PLAINTEXT)
    expect(await decryptToken(row.keyEnc as string, key)).toBe(PLAINTEXT)
    expect(row.keyFingerprint).toBe(await sha256HexRef(PLAINTEXT))
    expect(row.lastFour).toBe('WXYZ')
    expect(row.status).toBe('active')
    expect(row.organizationId).toBe('org_1')
    expect(row.provider).toBe('anthropic')

    // SECURITY: neither the persisted row nor the return value carries plaintext
    expect(JSON.stringify(row)).not.toContain(PLAINTEXT)
    expect(JSON.stringify(result)).not.toContain(PLAINTEXT)
    // return shape is display-only metadata, never key material
    expect(result).not.toHaveProperty('keyEnc')
    expect(result).not.toHaveProperty('plaintextKey')
    expect(result.lastFour).toBe('WXYZ')
    expect(result.status).toBe('active')
    expect(result.rotated).toBe(false) // fresh insert, not a rotation
  })

  it('UPDATES in place when an active row already exists (rotate / replace)', async () => {
    const key = generateEncryptionKey()
    const { db, captured } = makeCapturingDb([{ id: 'aik_existing' }])
    const NEW = 'sk-ant-api03-ROTATED-newvalue-0000pqrs'
    const result = await persistProviderKey(db, key, {
      organizationId: 'org_1',
      provider: 'anthropic',
      plaintextKey: NEW,
    })

    expect(captured.insert).toBeUndefined() // did not insert a duplicate
    const row = captured.update!
    expect(row.keyEnc).not.toBe(NEW)
    expect(await decryptToken(row.keyEnc as string, key)).toBe(NEW)
    expect(row.lastFour).toBe('pqrs')
    expect(row.status).toBe('active')
    expect(result.rotated).toBe(true) // replaced an existing active row
    expect(JSON.stringify(row)).not.toContain(NEW)
    expect(JSON.stringify(result)).not.toContain(NEW)
  })
})

// Independent reference implementation of the fingerprint so the test does not
// lean on the module under test to prove its own output.
async function sha256HexRef(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

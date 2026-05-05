import { describe, it, expect } from 'vitest'
import {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
} from './crypto'

// A known-good test key: 32 bytes, base64-encoded.
const TEST_KEY = Buffer.from(
  new Uint8Array([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  ]),
).toString('base64')

describe('encryptToken / decryptToken', () => {
  it('round-trips a plaintext string', async () => {
    const plaintext = 'airtable_access_token_abc123'
    const ciphertext = await encryptToken(plaintext, TEST_KEY)
    expect(ciphertext).not.toBe(plaintext)
    expect(ciphertext).not.toContain(plaintext)

    const decrypted = await decryptToken(ciphertext, TEST_KEY)
    expect(decrypted).toBe(plaintext)
  })

  it('produces a different ciphertext on each call for the same plaintext', async () => {
    const plaintext = 'same-plaintext'
    const a = await encryptToken(plaintext, TEST_KEY)
    const b = await encryptToken(plaintext, TEST_KEY)
    expect(a).not.toBe(b)
  })

  it('fails to decrypt with the wrong key', async () => {
    const ciphertext = await encryptToken('secret', TEST_KEY)
    const wrongKey = Buffer.alloc(32, 0).toString('base64')
    await expect(decryptToken(ciphertext, wrongKey)).rejects.toThrow()
  })

  it('fails to decrypt a tampered ciphertext', async () => {
    const ciphertext = await encryptToken('secret', TEST_KEY)
    // Flip a single byte in the middle of the blob (skip IV prefix).
    const raw = Buffer.from(ciphertext, 'base64')
    raw[raw.length - 5] ^= 0xff
    const tampered = raw.toString('base64')
    await expect(decryptToken(tampered, TEST_KEY)).rejects.toThrow()
  })

  it('rejects a key that is not 32 bytes', async () => {
    const shortKey = Buffer.alloc(16, 0).toString('base64')
    await expect(encryptToken('secret', shortKey)).rejects.toThrow(
      /32 bytes/i,
    )
  })

  it('rejects a key that is not valid base64', async () => {
    await expect(encryptToken('secret', 'not!!!base64@@@')).rejects.toThrow()
  })

  it('handles empty plaintext', async () => {
    const ciphertext = await encryptToken('', TEST_KEY)
    const decrypted = await decryptToken(ciphertext, TEST_KEY)
    expect(decrypted).toBe('')
  })

  it('handles unicode plaintext', async () => {
    const plaintext = 'résumé 🔐 日本語'
    const ciphertext = await encryptToken(plaintext, TEST_KEY)
    const decrypted = await decryptToken(ciphertext, TEST_KEY)
    expect(decrypted).toBe(plaintext)
  })
})

describe('generateEncryptionKey', () => {
  it('returns a 32-byte base64 key', () => {
    const key = generateEncryptionKey()
    expect(typeof key).toBe('string')
    const raw = Buffer.from(key, 'base64')
    expect(raw.length).toBe(32)
  })

  it('returns a different key on each call', () => {
    expect(generateEncryptionKey()).not.toBe(generateEncryptionKey())
  })
})

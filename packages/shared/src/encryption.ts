/**
 * AES-256-GCM at-rest encryption — the consolidated @baseout/shared home of
 * the byte-identical modules hand-copied in apps/web/src/lib/crypto.ts and
 * apps/server/src/lib/crypto.ts (consolidation was deferred "until a second
 * non-Worker consumer appears" — apps/hooks is that consumer: it decrypts
 * airtable_webhooks.mac_secret_base64_enc written by the engine).
 *
 * Output format (base64):  iv (12 bytes) || ciphertext+tag
 * Key: base64-encoded 32 bytes (env MASTER/BASEOUT_ENCRYPTION_KEY).
 * tests/encryption.test.ts imports the apps/web copy directly and round-trips
 * across implementations, so format drift fails CI. Web Crypto only.
 */

const KEY_BYTES = 32
const IV_BYTES = 12

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  let raw: Uint8Array
  try {
    raw = base64ToBytes(keyB64)
  } catch {
    throw new Error('encryption key is not valid base64')
  }
  if (raw.length !== KEY_BYTES) {
    throw new Error(`encryption key must decode to ${KEY_BYTES} bytes, got ${raw.length}`)
  }
  const keyBuf = new ArrayBuffer(raw.byteLength)
  new Uint8Array(keyBuf).set(raw)
  return crypto.subtle.importKey('raw', keyBuf, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptToken(plaintext: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const cipher = new Uint8Array(cipherBuf)
  const blob = new Uint8Array(iv.length + cipher.length)
  blob.set(iv, 0)
  blob.set(cipher, iv.length)
  return bytesToBase64(blob)
}

export async function decryptToken(ciphertextB64: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64)
  const blob = base64ToBytes(ciphertextB64)
  if (blob.length <= IV_BYTES) {
    throw new Error('ciphertext too short')
  }
  const iv = blob.slice(0, IV_BYTES)
  const cipher = blob.slice(IV_BYTES)
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plainBuf)
}

export function generateEncryptionKey(): string {
  const raw = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  return bytesToBase64(raw)
}

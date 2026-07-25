/**
 * Airtable webhook ping authentication (openspec/changes/hooks).
 *
 * Airtable signs every notification ping: X-Airtable-Content-MAC =
 * "hmac-sha256=" + hex( HMAC-SHA256( key = base64-decoded macSecretBase64,
 * message = RAW request body bytes ) ). Verification runs before any JSON
 * parse. This is a DIFFERENT primitive from the service-token HMAC in
 * ./hmac.ts. Web Crypto only — runs in workerd and Node.
 */

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Hex HMAC-SHA256 of the raw body, keyed by the base64-decoded MAC secret. */
export async function computeAirtableContentMac(
  rawBody: Uint8Array,
  macSecretBase64: string,
): Promise<string> {
  const secret = base64ToBytes(macSecretBase64)
  const keyBuf = new ArrayBuffer(secret.byteLength)
  new Uint8Array(keyBuf).set(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const bodyBuf = new ArrayBuffer(rawBody.byteLength)
  new Uint8Array(bodyBuf).set(rawBody)
  const mac = await crypto.subtle.sign('HMAC', key, bodyBuf)
  return bytesToHex(new Uint8Array(mac))
}

/** Constant-time string compare (both sides are fixed-format hex). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Verify an X-Airtable-Content-MAC header against the raw body. Accepts the
 * canonical `hmac-sha256=<hex>` form (and bare hex, defensively). Any
 * missing/malformed input → false, never a throw — the receiver maps false
 * to 401 without leaking why.
 */
export async function verifyAirtableContentMac(
  rawBody: Uint8Array,
  macSecretBase64: string,
  header: string | null,
): Promise<boolean> {
  if (!header) return false
  const presented = header.startsWith('hmac-sha256=')
    ? header.slice('hmac-sha256='.length)
    : header
  if (!/^[0-9a-f]{64}$/i.test(presented)) return false
  try {
    const expected = await computeAirtableContentMac(rawBody, macSecretBase64)
    return constantTimeEqual(expected, presented.toLowerCase())
  } catch {
    return false
  }
}

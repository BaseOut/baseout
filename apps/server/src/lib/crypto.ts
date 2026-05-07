/**
 * AES-256-GCM decryption for at-rest OAuth tokens.
 *
 * Per PRD §20.2: OAuth access + refresh tokens are encrypted before writing
 * to the master DB. apps/web is the canonical writer; apps/server reads the
 * encrypted column and decrypts here. The master key (env.BASEOUT_ENCRYPTION_KEY,
 * base64-encoded 32 bytes) MUST match apps/web's value.
 *
 * Format produced by apps/web/src/lib/crypto.ts (canonical encryption side):
 *   base64( iv (12 bytes) || ciphertext+tag )
 * GCM auth tag is appended to the ciphertext by Web Crypto automatically.
 *
 * This file intentionally exports ONLY `decryptToken`. The engine never
 * encrypts tokens — that is apps/web's role (OAuth callback) and, in the
 * future, the cron-oauth-refresh task. When refresh lands, an `encryptToken`
 * export joins this file (no extraction to packages/shared until there's
 * a second real call site).
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(keyB64);
  } catch {
    throw new Error("encryption key is not valid base64");
  }
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `encryption key must decode to ${KEY_BYTES} bytes, got ${raw.length}`,
    );
  }
  const keyBuf = new ArrayBuffer(raw.byteLength);
  new Uint8Array(keyBuf).set(raw);
  return crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

export async function decryptToken(
  ciphertextB64: string,
  keyB64: string,
): Promise<string> {
  const key = await importKey(keyB64);
  const blob = base64ToBytes(ciphertextB64);
  if (blob.length <= IV_BYTES) {
    throw new Error("ciphertext too short");
  }
  const iv = blob.slice(0, IV_BYTES);
  const cipher = blob.slice(IV_BYTES);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher,
  );
  return new TextDecoder().decode(plainBuf);
}

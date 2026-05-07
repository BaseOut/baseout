// Unit-level tests for the AES-256-GCM encrypt + decrypt helpers.
//
// Two layers of coverage:
//   - decryptToken is fed ciphertext from an inline helper that mirrors
//     apps/web's encryption byte-for-byte, asserting backward compatibility
//     with the canonical writer.
//   - encryptToken (added for the OAuth-refresh cron) is round-tripped
//     through decryptToken to assert the engine's own writer/reader are
//     symmetric, and through the inline helper to assert format equivalence
//     with apps/web.
//
// Runs inside the workerd vitest pool because that's the only configured
// pool. Web Crypto is available there.

import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../../src/lib/crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;

const KEY_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 zero bytes
const ALT_KEY_B64 = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="; // 32x 0x01

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] as number);
  }
  return btoa(bin);
}

async function encryptForTest(
  plaintext: string,
  keyB64: string,
): Promise<string> {
  const raw = base64ToBytes(keyB64);
  const keyBuf = new ArrayBuffer(raw.byteLength);
  new Uint8Array(keyBuf).set(raw);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const cipher = new Uint8Array(cipherBuf);
  const blob = new Uint8Array(iv.length + cipher.length);
  blob.set(iv, 0);
  blob.set(cipher, iv.length);
  return bytesToBase64(blob);
}

describe("decryptToken", () => {
  it("round-trips a plaintext encrypted with the same key", async () => {
    const plaintext = "patXXXXXXXXXXXXXX.aabbccddee0011223344"; // shaped like an Airtable token
    const ciphertext = await encryptForTest(plaintext, KEY_B64);
    const recovered = await decryptToken(ciphertext, KEY_B64);
    expect(recovered).toBe(plaintext);
  });

  it("throws when decrypting with a different key", async () => {
    const ciphertext = await encryptForTest("secret-value", KEY_B64);
    await expect(decryptToken(ciphertext, ALT_KEY_B64)).rejects.toThrow();
  });

  it("throws on truncated ciphertext (shorter than the IV)", async () => {
    // 8 bytes — shorter than the 12-byte IV requirement.
    const truncated = bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    await expect(decryptToken(truncated, KEY_B64)).rejects.toThrow(
      /ciphertext too short/i,
    );
  });

  it("throws when the key is not valid base64", async () => {
    const ciphertext = await encryptForTest("x", KEY_B64);
    await expect(decryptToken(ciphertext, "!!!not-base64!!!")).rejects.toThrow();
  });

  it("throws when the key decodes to the wrong length", async () => {
    const ciphertext = await encryptForTest("x", KEY_B64);
    const shortKeyB64 = bytesToBase64(new Uint8Array(16)); // 16 bytes, not 32
    await expect(decryptToken(ciphertext, shortKeyB64)).rejects.toThrow(
      new RegExp(`must decode to ${KEY_BYTES} bytes`),
    );
  });
});

describe("encryptToken", () => {
  it("round-trips a plaintext through decryptToken with the same key", async () => {
    const plaintext = "patXXXXXXXXXXXXXX.aabbccddee0011223344";
    const ciphertext = await encryptToken(plaintext, KEY_B64);
    const recovered = await decryptToken(ciphertext, KEY_B64);
    expect(recovered).toBe(plaintext);
  });

  it("produces output decryptable by the apps/web-format helper (cross-app compat)", async () => {
    // The inline helper at the top of this file mirrors apps/web/src/lib/
    // crypto.ts byte-for-byte. If apps/server's encryptToken diverges from
    // that format, this test fails before any cron code can corrupt prod
    // tokens — the explicit guard for cross-app crypto compatibility called
    // out in the design doc.
    const plaintext = "secret-token-from-engine";
    const ciphertext = await encryptToken(plaintext, KEY_B64);

    // Decode and validate format: base64( iv (12 bytes) || ciphertext+tag ).
    const blob = base64ToBytes(ciphertext);
    expect(blob.length).toBeGreaterThan(IV_BYTES);

    // Round-trip via the apps/web mirror by reconstructing the helper's
    // decrypt path inline (the helper itself only encrypts).
    const iv = blob.slice(0, IV_BYTES);
    const cipher = blob.slice(IV_BYTES);
    const raw = base64ToBytes(KEY_B64);
    const keyBuf = new ArrayBuffer(raw.byteLength);
    new Uint8Array(keyBuf).set(raw);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuf,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipher,
    );
    expect(new TextDecoder().decode(plainBuf)).toBe(plaintext);
  });

  it("produces a fresh IV on each call (no nonce reuse)", async () => {
    const plaintext = "stable-input";
    const a = await encryptToken(plaintext, KEY_B64);
    const b = await encryptToken(plaintext, KEY_B64);
    expect(a).not.toBe(b);

    // First 12 bytes of the base64-decoded blob are the IV — confirm distinct.
    const ivA = base64ToBytes(a).slice(0, IV_BYTES);
    const ivB = base64ToBytes(b).slice(0, IV_BYTES);
    expect(Array.from(ivA)).not.toEqual(Array.from(ivB));
  });

  it("decrypted ciphertext fails under a different key (auth tag rejects)", async () => {
    const ciphertext = await encryptToken("secret-value", KEY_B64);
    await expect(decryptToken(ciphertext, ALT_KEY_B64)).rejects.toThrow();
  });

  it("rejects an invalid encryption key", async () => {
    await expect(encryptToken("x", "!!!not-base64!!!")).rejects.toThrow();
  });

  it("rejects a wrong-length encryption key", async () => {
    const shortKeyB64 = bytesToBase64(new Uint8Array(16));
    await expect(encryptToken("x", shortKeyB64)).rejects.toThrow(
      new RegExp(`must decode to ${KEY_BYTES} bytes`),
    );
  });
});

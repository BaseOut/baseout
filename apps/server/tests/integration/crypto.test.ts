// Unit-level tests for the AES-256-GCM decrypt helper.
//
// Generates a fresh ciphertext at test time using crypto.subtle directly,
// then asserts the helper round-trips it. Format must match apps/web's
// crypto.ts (the canonical writer): base64( iv (12 bytes) || ciphertext+tag ).
//
// Runs inside the workerd vitest pool because that's the only configured
// pool. Web Crypto is available there.

import { describe, expect, it } from "vitest";
import { decryptToken } from "../../src/lib/crypto";

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

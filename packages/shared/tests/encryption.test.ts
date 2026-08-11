// AES-256-GCM at-rest encryption (@baseout/shared/encryption). The format MUST
// stay byte-compatible with the hand-copied apps/web + apps/server modules —
// apps/server (Phase E) encrypts webhook MAC secrets that apps/hooks decrypts
// through THIS module, and OAuth tokens already at rest use the same layout:
// base64( iv(12) || ciphertext+tag ), key = base64 32 bytes.
import { describe, expect, test } from "vitest";

import { decryptToken, encryptToken, generateEncryptionKey } from "../src/encryption";
// The canonical hand-copied implementation — imported directly so drift between
// the packages fails HERE, not in production.
import {
  decryptToken as webDecrypt,
  encryptToken as webEncrypt,
} from "../../../apps/web/src/lib/crypto";

const KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="; // base64("0123...def"), 32 bytes

describe("encryptToken / decryptToken", () => {
  test("round-trips", async () => {
    const out = await decryptToken(await encryptToken("s3cret-mac-key", KEY), KEY);
    expect(out).toBe("s3cret-mac-key");
  });

  test("is byte-compatible with the apps/web implementation, both directions", async () => {
    expect(await decryptToken(await webEncrypt("cross-1", KEY), KEY)).toBe("cross-1");
    expect(await webDecrypt(await encryptToken("cross-2", KEY), KEY)).toBe("cross-2");
  });

  test("rejects a wrong-length or non-base64 key", async () => {
    await expect(encryptToken("x", "dG9vc2hvcnQ=")).rejects.toThrow(/32 bytes/);
    await expect(encryptToken("x", "!!!not-base64!!!")).rejects.toThrow(/base64/);
  });

  test("rejects tampered ciphertext (GCM auth)", async () => {
    const blob = await encryptToken("payload", KEY);
    const bytes = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0xff;
    const tampered = btoa(String.fromCharCode(...bytes));
    await expect(decryptToken(tampered, KEY)).rejects.toThrow();
  });

  test("generateEncryptionKey mints a valid 32-byte base64 key", async () => {
    const key = generateEncryptionKey();
    expect(await decryptToken(await encryptToken("k", key), key)).toBe("k");
  });
});

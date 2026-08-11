#!/usr/bin/env -S node --experimental-strip-types --no-warnings
// Cross-app crypto compatibility verifier.
//
// Imports BOTH apps/web/src/lib/crypto.ts and apps/server/src/lib/crypto.ts
// in the same Node process and runs every cross-product: encrypt with one,
// decrypt with the other. Catches format divergence between the two writers
// — the highest-risk regression in the OAuth-refresh cron change, since a
// silent format diff would corrupt every refreshed token.
//
// Run on demand:
//   node --experimental-strip-types scripts/verify-crypto-compat.ts
// (or simply: ./scripts/verify-crypto-compat.ts)
//
// Both source files use Web Crypto only — no Workers-specific imports, no
// internal module references — so they run unchanged in Node 24 with
// crypto.subtle on globalThis.

import {
  encryptToken as webEncrypt,
  decryptToken as webDecrypt,
} from "../apps/web/src/lib/crypto.ts";
import {
  encryptToken as serverEncrypt,
  decryptToken as serverDecrypt,
} from "../apps/server/src/lib/crypto.ts";

const KEY_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 zero bytes
const PLAINTEXT = "patXXXXXXXXXXXXXX.aabbccddee0011223344"; // shaped like an Airtable token

interface Case {
  name: string;
  encrypt: (p: string, k: string) => Promise<string>;
  decrypt: (c: string, k: string) => Promise<string>;
}

const cases: Case[] = [
  { name: "web → web      ", encrypt: webEncrypt, decrypt: webDecrypt },
  { name: "web → server   ", encrypt: webEncrypt, decrypt: serverDecrypt },
  { name: "server → server", encrypt: serverEncrypt, decrypt: serverDecrypt },
  { name: "server → web   ", encrypt: serverEncrypt, decrypt: webDecrypt },
];

let failures = 0;

for (const c of cases) {
  try {
    const ciphertext = await c.encrypt(PLAINTEXT, KEY_B64);
    const recovered = await c.decrypt(ciphertext, KEY_B64);
    if (recovered === PLAINTEXT) {
      console.log(`OK    ${c.name}  (${ciphertext.length} chars)`);
    } else {
      console.log(`FAIL  ${c.name}  recovered="${recovered}"`);
      failures++;
    }
  } catch (err) {
    console.log(`FAIL  ${c.name}  threw: ${(err as Error).message}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} of ${cases.length} cross-app round-trips failed.`);
  process.exit(1);
}

console.log(`\n${cases.length}/${cases.length} cross-app round-trips passed.`);

// Airtable webhook ping authentication (@baseout/shared/airtable-mac):
// X-Airtable-Content-MAC = "hmac-sha256=" + hex( HMAC-SHA256( key = base64-
// decoded macSecretBase64, message = raw request body bytes ) ). Consumed by
// apps/hooks before any JSON parse (openspec/changes/hooks).
import { describe, expect, test } from "vitest";

import { computeAirtableContentMac, verifyAirtableContentMac } from "../src/airtable-mac";

// Fixed vector (computed independently): secret = base64(bytes 0..31).
const SECRET_B64 = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const BODY =
  '{"base":{"id":"appTEST"},"webhook":{"id":"achTEST"},"timestamp":"2026-07-21T00:00:00Z"}';
const EXPECTED_HEX = "d19ac4b679f791b8f00707f5ad93368f9b1c95c37e16ae67994adf5a1facf8bb";

const bodyBytes = new TextEncoder().encode(BODY);

describe("computeAirtableContentMac", () => {
  test("matches the independently computed HMAC-SHA256 hex", async () => {
    expect(await computeAirtableContentMac(bodyBytes, SECRET_B64)).toBe(EXPECTED_HEX);
  });
});

describe("verifyAirtableContentMac", () => {
  test("accepts the canonical hmac-sha256=<hex> header form", async () => {
    expect(
      await verifyAirtableContentMac(bodyBytes, SECRET_B64, `hmac-sha256=${EXPECTED_HEX}`),
    ).toBe(true);
  });

  test("accepts a bare hex header (defensive against form drift)", async () => {
    expect(await verifyAirtableContentMac(bodyBytes, SECRET_B64, EXPECTED_HEX)).toBe(true);
  });

  test("rejects a tampered body", async () => {
    const tampered = new TextEncoder().encode(BODY.replace("appTEST", "appEVIL"));
    expect(
      await verifyAirtableContentMac(tampered, SECRET_B64, `hmac-sha256=${EXPECTED_HEX}`),
    ).toBe(false);
  });

  test("rejects a wrong secret, missing header, and malformed header", async () => {
    const otherSecret = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
    expect(
      await verifyAirtableContentMac(bodyBytes, otherSecret, `hmac-sha256=${EXPECTED_HEX}`),
    ).toBe(false);
    expect(await verifyAirtableContentMac(bodyBytes, SECRET_B64, null)).toBe(false);
    expect(await verifyAirtableContentMac(bodyBytes, SECRET_B64, "")).toBe(false);
    expect(await verifyAirtableContentMac(bodyBytes, SECRET_B64, "hmac-sha256=zzzz")).toBe(false);
  });
});

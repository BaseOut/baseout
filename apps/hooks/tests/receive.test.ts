// Tests for the pure Airtable ping receiver (openspec/changes/hooks).
// Verification order under test (design "HMAC verification order"):
//   raw body cap → row lookup (410) → MAC verify (401, real crypto) →
//   JSON cross-check (401) → upsert (503 on failure) → 200 empty body.
import { describe, expect, it, vi } from "vitest";
import {
  computeAirtableContentMac,
  encryptToken,
  generateEncryptionKey,
} from "@baseout/shared";

import { handlePing, MAX_BODY_BYTES, type HandlePingDeps } from "../src/receive";

const ROW_ID = "55555555-5555-5555-5555-555555555555";
const KEY = generateEncryptionKey();
const MAC_SECRET_B64 = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

const PING_BODY = JSON.stringify({
  base: { id: "appPING" },
  webhook: { id: "achPING" },
  timestamp: "2026-07-21T12:00:00.000Z",
});
const bodyBytes = new TextEncoder().encode(PING_BODY);

async function macHeader(body: Uint8Array, secretB64 = MAC_SECRET_B64): Promise<string> {
  return `hmac-sha256=${await computeAirtableContentMac(body, secretB64)}`;
}

async function makeDeps(overrides: Partial<HandlePingDeps> = {}): Promise<HandlePingDeps> {
  const encSecret = await encryptToken(MAC_SECRET_B64, KEY);
  return {
    fetchWebhookRow: vi.fn(async () => ({
      id: ROW_ID,
      airtableWebhookId: "achPING",
      baseId: "appPING",
      macSecretBase64Enc: encSecret,
      status: "active",
    })),
    recordPing: vi.fn(async () => {}),
    encryptionKey: KEY,
    log: vi.fn(),
    now: () => new Date("2026-07-21T12:00:01Z"),
    ...overrides,
  };
}

async function ping(args: {
  deps: HandlePingDeps;
  body?: Uint8Array;
  mac?: string | null;
  rowId?: string;
  sourceIp?: string | null;
}): Promise<Response> {
  return handlePing({
    webhookRowId: args.rowId ?? ROW_ID,
    rawBody: args.body ?? bodyBytes,
    macHeader: args.mac === undefined ? await macHeader(args.body ?? bodyBytes) : args.mac,
    sourceIp: args.sourceIp ?? "203.0.113.7",
    deps: args.deps,
  });
}

describe("handlePing — happy path", () => {
  it("verifies the MAC, stamps last_ping_at + source ip, and returns 200 with an EMPTY body", async () => {
    const deps = await makeDeps();
    const res = await ping({ deps });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(""); // Airtable requires 200/204 + empty body
    expect(deps.recordPing).toHaveBeenCalledWith(ROW_ID, deps.now(), "203.0.113.7");
  });

  it("is idempotent under a burst — every verified ping upserts and 200s", async () => {
    const deps = await makeDeps();
    for (let i = 0; i < 3; i++) expect((await ping({ deps })).status).toBe(200);
    expect(deps.recordPing).toHaveBeenCalledTimes(3);
  });
});

describe("handlePing — rejection matrix", () => {
  it("410 for an unknown webhook row id", async () => {
    const deps = await makeDeps({ fetchWebhookRow: vi.fn(async () => null) });
    const res = await ping({ deps });
    expect(res.status).toBe(410);
    expect(deps.recordPing).not.toHaveBeenCalled();
  });

  it("410 for an inactive row", async () => {
    const deps = await makeDeps();
    const row = await deps.fetchWebhookRow(ROW_ID);
    deps.fetchWebhookRow = vi.fn(async () => ({ ...row!, status: "inactive" }));
    expect((await ping({ deps })).status).toBe(410);
  });

  it("401 when the MAC header is missing or malformed", async () => {
    const deps = await makeDeps();
    expect((await ping({ deps, mac: null })).status).toBe(401);
    expect((await ping({ deps, mac: "hmac-sha256=nope" })).status).toBe(401);
    expect(deps.recordPing).not.toHaveBeenCalled();
  });

  it("401 when the MAC doesn't match the body (tamper)", async () => {
    const deps = await makeDeps();
    const tampered = new TextEncoder().encode(PING_BODY.replace("appPING", "appEVIL"));
    const res = await ping({ deps, body: tampered, mac: await macHeader(bodyBytes) });
    expect(res.status).toBe(401);
  });

  it("401 when the body's webhook.id or base.id doesn't match the row", async () => {
    const deps = await makeDeps();
    const wrongHook = new TextEncoder().encode(PING_BODY.replace("achPING", "achOTHER"));
    expect((await ping({ deps, body: wrongHook, mac: await macHeader(wrongHook) })).status).toBe(401);
    const wrongBase = new TextEncoder().encode(PING_BODY.replace("appPING", "appOTHER"));
    expect((await ping({ deps, body: wrongBase, mac: await macHeader(wrongBase) })).status).toBe(401);
    expect(deps.log).toHaveBeenCalled(); // cross-check mismatch warns
  });

  it("401 for an oversized body BEFORE any verification work", async () => {
    const deps = await makeDeps();
    const huge = new Uint8Array(MAX_BODY_BYTES + 1);
    const res = await ping({ deps, body: huge, mac: "hmac-sha256=deadbeef" });
    expect(res.status).toBe(401);
    expect(deps.fetchWebhookRow).not.toHaveBeenCalled();
  });

  it("503 when the registry upsert fails (Airtable will retry)", async () => {
    const deps = await makeDeps({
      recordPing: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    expect((await ping({ deps })).status).toBe(503);
  });

  it("401 (not a crash) when the stored secret fails to decrypt", async () => {
    const deps = await makeDeps();
    const row = await deps.fetchWebhookRow(ROW_ID);
    deps.fetchWebhookRow = vi.fn(async () => ({ ...row!, macSecretBase64Enc: "garbage" }));
    expect((await ping({ deps })).status).toBe(401);
  });
});

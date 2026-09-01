// Wire-layer security regression suite for the public receiver
// (openspec/changes/hooks task 5.2 — security review). The pure ping logic is
// covered by receive.test.ts; this file guards apps/hooks's *public routing
// surface*: path-id enumeration/traversal, HTTP-method bypass, and fail-closed
// behaviour on misconfiguration.
//
// Every case here stops BEFORE the master-DB seam, so no connection is opened:
// unmatched path → 404, wrong method → 405, and missing key → 503 all return
// ahead of createMasterDb(). We probe the route regex with GET (405 = the path
// matched, 404 = it didn't) precisely so a matched path never reaches the DB.

import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

const VALID = "/webhooks/airtable/55555555-5555-5555-5555-555555555555";

function env(overrides: Partial<Env> = {}): Env {
  return { BASEOUT_ENCRYPTION_KEY: "test-key", DATABASE_URL: "postgres://unused/never-connected", ...overrides };
}

// Fresh per test so "DB never opened" (waitUntil never called) is isolated.
function newCtx() {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function req(path: string, method = "POST", headers: Record<string, string> = {}): Request {
  return new Request(`https://hooks.baseout.com${path}`, { method, headers });
}

describe("hooks worker — path routing surface (enumeration / traversal)", () => {
  it("404s anything that is not exactly the webhook route", async () => {
    const notRoutes = [
      "/",
      "/webhooks",
      "/webhooks/airtable",
      "/webhooks/airtable/", // no id
      "/webhooks/airtable/not-a-uuid",
      "/webhooks/airtable/12345", // too short
      "/webhooks/airtable/gggggggg-gggg-gggg-gggg-gggggggggggg", // non-hex
      "/webhooks/slack/55555555-5555-5555-5555-555555555555", // wrong provider
      `${VALID}/extra`, // trailing segment
      `${VALID}/../../admin`, // traversal — URL-normalized away, must not match
    ];
    for (const p of notRoutes) {
      const ctx = newCtx();
      const res = await worker.fetch(req(p, "GET"), env(), ctx);
      expect(res.status, p).toBe(404);
      expect(ctx.waitUntil, `${p} opened a DB`).not.toHaveBeenCalled();
    }
  });

  it("matches a UUID-shaped id — GET on the route is 405 (matched), proving no DB is touched to route", async () => {
    const ctx = newCtx();
    const res = await worker.fetch(req(VALID, "GET"), env(), ctx);
    expect(res.status).toBe(405);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });
});

describe("hooks worker — method gate", () => {
  it.each(["GET", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])(
    "405s %s on the webhook route (only Airtable POSTs are accepted)",
    async (method) => {
      const ctx = newCtx();
      const res = await worker.fetch(req(VALID, method), env(), ctx);
      expect(res.status).toBe(405);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    },
  );
});

describe("hooks worker — fail-closed on misconfiguration", () => {
  it("503s (empty body) a valid POST when BASEOUT_ENCRYPTION_KEY is absent, before any DB work", async () => {
    const ctx = newCtx();
    const res = await worker.fetch(req(VALID, "POST"), env({ BASEOUT_ENCRYPTION_KEY: undefined }), ctx);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(""); // Airtable contract: 200/204 empty on success; non-2xx must not carry a body it parses
    expect(ctx.waitUntil).not.toHaveBeenCalled(); // never constructed the master DB
  });
});

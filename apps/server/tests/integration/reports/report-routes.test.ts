import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SID = "11111111-1111-1111-1111-111111111111";
const DID = "22222222-2222-2222-2222-222222222222";
const RID = "33333333-3333-3333-3333-333333333333";

const authed = (extra: RequestInit = {}): RequestInit => ({
  ...extra,
  headers: { "x-internal-token": TOKEN, "content-type": "application/json", ...(extra.headers ?? {}) },
});

describe("report routes — middleware token gate", () => {
  it("401 without the internal token on list", async () => {
    const res = await SELF.fetch(`http://test/api/internal/spaces/${SID}/reports`, { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("401 on the render callback without the token", async () => {
    const res = await SELF.fetch(`http://test/api/internal/reports/runs/${RID}/rendered`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});

describe("report routes — method + UUID guards", () => {
  it("405 on a non-GET/POST verb to the collection", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SID}/reports`,
      authed({ method: "DELETE" }),
    );
    expect(res.status).toBe(405);
  });

  it("400 invalid_request when spaceId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/not-a-uuid/reports`,
      authed({ method: "GET" }),
    );
    expect(res.status).toBe(400);
  });

  it("405 on GET to generate (POST-only)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SID}/reports/${DID}/generate`,
      authed({ method: "GET" }),
    );
    expect(res.status).toBe(405);
  });

  it("400 when the artifact format is missing", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/spaces/${SID}/reports/runs/${RID}/artifact`,
      authed({ method: "GET" }),
    );
    expect(res.status).toBe(400);
  });

  it("405 on GET to the render callback (POST-only)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/reports/runs/${RID}/rendered`,
      authed({ method: "GET" }),
    );
    expect(res.status).toBe(405);
  });

  it("400 invalid body on the render callback", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/reports/runs/${RID}/rendered`,
      authed({ method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });
});

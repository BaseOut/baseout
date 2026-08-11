// Routing-layer tests for the Health Pro+ routes (server-schema-health-scoring
// §4.2c): config (GET), rerun/prompt/enable (POST). Real behavior needs a
// provisioned managed_pg Space; this pins the HTTP guards.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE = "11111111-1111-1111-1111-111111111111";
const auth = { "x-internal-token": TEST_TOKEN, "content-type": "application/json" };

describe("GET /health-config", () => {
  const u = (s: string, b?: string) =>
    `http://test/api/internal/spaces/${s}/health-config${b ? `?baseId=${b}` : ""}`;
  it("401 without token", async () => expect((await SELF.fetch(u(SPACE, "appX"))).status).toBe(401));
  it("405 on POST", async () =>
    expect((await SELF.fetch(u(SPACE, "appX"), { method: "POST", headers: auth })).status).toBe(405));
  it("400 on a non-UUID space", async () =>
    expect((await SELF.fetch(u("nope", "appX"), { headers: auth })).status).toBe(400));
  it("400 when baseId is missing", async () =>
    expect((await SELF.fetch(u(SPACE), { headers: auth })).status).toBe(400));
});

describe("POST /health-rerun", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/health-rerun`;
  it("401 without token", async () => expect((await SELF.fetch(u(SPACE), { method: "POST" })).status).toBe(401));
  it("405 on GET", async () => expect((await SELF.fetch(u(SPACE), { headers: auth })).status).toBe(405));
  it("400 when baseId is missing", async () =>
    expect((await SELF.fetch(u(SPACE), { method: "POST", headers: auth, body: "{}" })).status).toBe(400));
});

describe("POST /health-prompt", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/health-prompt`;
  it("401 without token", async () => expect((await SELF.fetch(u(SPACE), { method: "POST" })).status).toBe(401));
  it("405 on GET", async () => expect((await SELF.fetch(u(SPACE), { headers: auth })).status).toBe(405));
  it("400 on an unknown level", async () =>
    expect(
      (
        await SELF.fetch(u(SPACE), {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ ruleId: "r1", level: "bogus", prompt: "x" }),
        })
      ).status,
    ).toBe(400));
  it("400 when prompt is omitted", async () =>
    expect(
      (
        await SELF.fetch(u(SPACE), {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ ruleId: "r1", level: "space" }),
        })
      ).status,
    ).toBe(400));
});

describe("POST /health-enable", () => {
  const u = (s: string) => `http://test/api/internal/spaces/${s}/health-enable`;
  it("401 without token", async () => expect((await SELF.fetch(u(SPACE), { method: "POST" })).status).toBe(401));
  it("405 on GET", async () => expect((await SELF.fetch(u(SPACE), { headers: auth })).status).toBe(405));
  it("400 when enabled is not a boolean", async () =>
    expect(
      (
        await SELF.fetch(u(SPACE), {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ baseId: "appX", ruleId: "r1", enabled: "yes" }),
        })
      ).status,
    ).toBe(400));
});

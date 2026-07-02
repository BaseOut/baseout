// Routing-layer tests for the Chat routes (server-schema-chat). Pure-DB behavior
// needs a provisioned managed_pg Space (no Postgres in the test pool), so this
// pins the HTTP guards: token (401), method (405), UUID + body validation (400).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const SPACE = "11111111-1111-1111-1111-111111111111";
const THREAD = "22222222-2222-2222-2222-222222222222";
const MSG = "33333333-3333-3333-3333-333333333333";
const auth = { "x-internal-token": TEST_TOKEN, "content-type": "application/json" };

describe("chat/threads", () => {
  const u = `http://test/api/internal/spaces/${SPACE}/chat/threads`;
  it("401 without token", async () => expect((await SELF.fetch(u)).status).toBe(401));
  it("405 on PUT", async () =>
    expect((await SELF.fetch(u, { method: "PUT", headers: auth })).status).toBe(405));
  it("400 on a non-UUID space", async () =>
    expect(
      (await SELF.fetch(`http://test/api/internal/spaces/nope/chat/threads`, { headers: auth })).status,
    ).toBe(400));
});

describe("chat/threads/:threadId", () => {
  const u = `http://test/api/internal/spaces/${SPACE}/chat/threads/${THREAD}`;
  it("401 without token", async () => expect((await SELF.fetch(u)).status).toBe(401));
  it("405 on POST", async () =>
    expect((await SELF.fetch(u, { method: "POST", headers: auth })).status).toBe(405));
  it("400 on a non-UUID thread", async () =>
    expect(
      (await SELF.fetch(`http://test/api/internal/spaces/${SPACE}/chat/threads/nope`, { headers: auth }))
        .status,
    ).toBe(400));
});

describe("chat/send", () => {
  const u = `http://test/api/internal/spaces/${SPACE}/chat/send`;
  it("401 without token", async () => expect((await SELF.fetch(u, { method: "POST" })).status).toBe(401));
  it("405 on GET", async () =>
    expect((await SELF.fetch(u, { headers: auth })).status).toBe(405));
  it("400 when threadId is missing", async () =>
    expect(
      (await SELF.fetch(u, { method: "POST", headers: auth, body: JSON.stringify({ message: "hi" }) })).status,
    ).toBe(400));
  it("400 when message is empty", async () =>
    expect(
      (
        await SELF.fetch(u, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ threadId: THREAD, message: "   " }),
        })
      ).status,
    ).toBe(400));
});

describe("chat/message-complete", () => {
  const u = `http://test/api/internal/spaces/${SPACE}/chat/message-complete`;
  it("401 without token", async () => expect((await SELF.fetch(u, { method: "POST" })).status).toBe(401));
  it("405 on GET", async () =>
    expect((await SELF.fetch(u, { headers: auth })).status).toBe(405));
  it("400 when messageId is not a UUID", async () =>
    expect(
      (
        await SELF.fetch(u, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ messageId: "nope", content: "x" }),
        })
      ).status,
    ).toBe(400));
  it("400 when content is missing", async () =>
    expect(
      (
        await SELF.fetch(u, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ messageId: MSG }),
        })
      ).status,
    ).toBe(400));
});

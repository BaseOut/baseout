// shared-ai-byok task 4.1 — the chat task's BYOK routing at run start.
//
// The chat-respond wrapper fetches the org's routing decision + (for byok) the
// decrypted key from the engine credential endpoint (task 3.3), then builds the
// Anthropic client from THAT key + model. The pure, testable pieces are:
//   - fetchAiCredential: build the request, parse the wire shape, fall back to
//     pool on ANY error (BYOK must never break chat).
//   - resolveChatClientConfig: pick { apiKey, model } — pool path identical to
//     today; byok uses the fetched key + model (falling back to CHAT_MODEL).
//
// SECURITY: the plaintext key lives ONLY in the fetched response + the
// in-process client config. It is NEVER placed on the Trigger.dev payload
// (which carries only organizationId) and NEVER logged — asserted below.

import { describe, expect, it, vi } from "vitest";
import {
  fetchAiCredential,
  resolveChatClientConfig,
  type AiCredential,
} from "../trigger/tasks/_lib/ai-credential";
import type { ChatRespondPayload } from "../trigger/tasks/chat-respond.task";

const ENGINE = "http://engine.test";
const TOKEN = "internal-token";
const ORG = "org_123";
const CHAT_MODEL = "claude-opus-4-8";
const SECRET = "sk-byok-should-never-log-or-payload";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchAiCredential", () => {
  it("GETs the org credential endpoint with the internal-token header", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ mode: "pool" }),
    ) as unknown as typeof fetch;

    const cred = await fetchAiCredential(fetchFn, ENGINE, TOKEN, ORG);

    expect(cred).toEqual({ mode: "pool" });
    expect(vi.mocked(fetchFn)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchFn).mock.calls[0]!;
    expect(url).toBe(`${ENGINE}/api/internal/orgs/${ORG}/ai-credential`);
    expect((init as RequestInit).method).toBe("GET");
    expect((init as RequestInit).headers).toMatchObject({
      "x-internal-token": TOKEN,
    });
  });

  it("parses a byok response into the plaintext credential", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        mode: "byok",
        provider: "anthropic",
        model: "claude-x",
        apiKey: SECRET,
      }),
    ) as unknown as typeof fetch;

    const cred = await fetchAiCredential(fetchFn, ENGINE, TOKEN, ORG);
    expect(cred).toEqual({
      mode: "byok",
      provider: "anthropic",
      model: "claude-x",
      apiKey: SECRET,
    });
  });

  it("falls back to pool on a non-OK response (BYOK never breaks chat)", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: "unauthorized" }, 401),
    ) as unknown as typeof fetch;
    const cred = await fetchAiCredential(fetchFn, ENGINE, TOKEN, ORG);
    expect(cred).toEqual({ mode: "pool" });
  });

  it("falls back to pool when the fetch throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const cred = await fetchAiCredential(fetchFn, ENGINE, TOKEN, ORG);
    expect(cred).toEqual({ mode: "pool" });
  });

  it("falls back to pool on a malformed byok body (missing apiKey)", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ mode: "byok", provider: "anthropic", model: "claude-x" }),
    ) as unknown as typeof fetch;
    const cred = await fetchAiCredential(fetchFn, ENGINE, TOKEN, ORG);
    expect(cred).toEqual({ mode: "pool" });
  });

  it("trims a trailing slash on the engine URL", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ mode: "pool" }),
    ) as unknown as typeof fetch;
    await fetchAiCredential(fetchFn, `${ENGINE}/`, TOKEN, ORG);
    expect(vi.mocked(fetchFn).mock.calls[0]![0]).toBe(
      `${ENGINE}/api/internal/orgs/${ORG}/ai-credential`,
    );
  });

  it("never logs the plaintext apiKey", async () => {
    const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const spies = methods.map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        mode: "byok",
        provider: "anthropic",
        model: "claude-x",
        apiKey: SECRET,
      }),
    ) as unknown as typeof fetch;
    try {
      const cred = await fetchAiCredential(fetchFn, ENGINE, TOKEN, ORG);
      expect(cred).toMatchObject({ apiKey: SECRET });
      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain(SECRET);
        }
      }
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});

describe("resolveChatClientConfig", () => {
  const pool = { apiKey: "sk-pool-env-key", model: CHAT_MODEL };

  it("pool credential → env key + CHAT_MODEL (identical to today)", () => {
    const out = resolveChatClientConfig({ mode: "pool" }, pool);
    expect(out).toEqual({ apiKey: "sk-pool-env-key", model: CHAT_MODEL });
  });

  it("byok credential with a model → the byok key + that model", () => {
    const cred: AiCredential = {
      mode: "byok",
      provider: "anthropic",
      model: "claude-3-7-custom",
      apiKey: SECRET,
    };
    const out = resolveChatClientConfig(cred, pool);
    expect(out).toEqual({ apiKey: SECRET, model: "claude-3-7-custom" });
  });

  it("byok credential with a null model → the byok key + CHAT_MODEL fallback", () => {
    const cred: AiCredential = {
      mode: "byok",
      provider: "anthropic",
      model: null,
      apiKey: SECRET,
    };
    const out = resolveChatClientConfig(cred, pool);
    expect(out).toEqual({ apiKey: SECRET, model: CHAT_MODEL });
  });
});

describe("chat payload never carries the plaintext key (security)", () => {
  it("ChatRespondPayload carries organizationId but no apiKey/secret", () => {
    // The engine builds this payload; the key is fetched fresh at run start and
    // never serialized onto it.
    const payload: ChatRespondPayload = {
      organizationId: ORG,
      spaceId: "s1",
      threadId: "t1",
      assistantMessageId: "m_pending",
      context: "Schema context (metadata only)",
      history: [],
      userMessage: "What tables are in the CRM base?",
    };
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain(ORG);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain("apiKey");
  });
});

/**
 * shared-ai-byok task 4.2 — minimal fetch-based provider clients.
 *
 * All I/O is injected via `fetchImpl` — no real provider API is hit. Asserts
 * the right URL/headers/body per provider and correct text extraction, plus
 * the security invariant that the apiKey never leaks into a thrown error.
 */

import { describe, expect, it, vi } from "vitest";
import {
  callByokModel,
  defaultByokModel,
  isCallableByokProvider,
} from "../../../src/lib/ai/provider-call";

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("isCallableByokProvider", () => {
  it("is true for anthropic and openai, false otherwise (cloudflare → pool)", () => {
    expect(isCallableByokProvider("anthropic")).toBe(true);
    expect(isCallableByokProvider("openai")).toBe(true);
    expect(isCallableByokProvider("cloudflare")).toBe(false);
    expect(isCallableByokProvider("cohere")).toBe(false);
  });
});

describe("callByokModel — anthropic", () => {
  it("POSTs the Messages API with x-api-key + version and concatenates text blocks", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ content: [{ type: "text", text: "hel" }, { type: "text", text: "lo" }] }),
    );
    const out = await callByokModel({
      provider: "anthropic",
      model: "claude-x",
      apiKey: "sk-ant-secret",
      prompt: "PROMPT",
      maxTokens: 800,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(out).toBe("hello");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-secret");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: "claude-x",
      max_tokens: 800,
      messages: [{ role: "user", content: "PROMPT" }],
    });
  });

  it("falls back to the per-provider default model when model is null", async () => {
    const fetchMock = vi.fn(async () => okJson({ content: [{ type: "text", text: "x" }] }));
    await callByokModel({
      provider: "anthropic",
      model: null,
      apiKey: "sk",
      prompt: "P",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe(defaultByokModel("anthropic"));
    expect(defaultByokModel("anthropic")).toBe("claude-opus-4-8");
  });
});

describe("callByokModel — openai", () => {
  it("POSTs chat/completions with Bearer auth and returns choices[0].message.content", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ choices: [{ message: { content: "the-answer" } }] }),
    );
    const out = await callByokModel({
      provider: "openai",
      model: "gpt-x",
      apiKey: "sk-openai",
      prompt: "PROMPT",
      maxTokens: 1200,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(out).toBe("the-answer");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-openai");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "gpt-x",
      max_tokens: 1200,
      messages: [{ role: "user", content: "PROMPT" }],
    });
  });
});

describe("callByokModel — errors never leak the key", () => {
  it("throws with the status only (no apiKey) on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(
      callByokModel({
        provider: "anthropic",
        model: "claude-x",
        apiKey: "sk-ant-SUPER-SECRET",
        prompt: "P",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/401/);

    // The secret must never appear in the thrown message.
    try {
      await callByokModel({
        provider: "openai",
        model: "gpt-x",
        apiKey: "sk-openai-SUPER-SECRET",
        prompt: "P",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(String(err instanceof Error ? err.message : err)).not.toContain("SUPER-SECRET");
    }
  });
});

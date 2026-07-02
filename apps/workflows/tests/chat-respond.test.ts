// Tests for runChatRespond (workflows-schema-chat) — the pure reply driver.

import { describe, expect, it, vi } from "vitest";
import { runChatRespond, type ChatTurn } from "../trigger/tasks/chat-respond";

const base = {
  spaceId: "s1",
  threadId: "t1",
  assistantMessageId: "m_pending",
  context: "Schema context (whole Space): ...",
  history: [] as ChatTurn[],
  userMessage: "What tables are in the CRM base?",
};

describe("runChatRespond", () => {
  it("generates a reply and posts it complete", async () => {
    const generate = vi.fn(async () => "The CRM base has Contacts and Deals.");
    const postComplete = vi.fn(async () => {});
    const out = await runChatRespond(base, { generate, postComplete });

    expect(out).toEqual({ ok: true, status: "complete" });
    // history (empty) + the new user message
    expect(generate).toHaveBeenCalledWith({
      context: base.context,
      messages: [{ role: "user", content: base.userMessage }],
    });
    expect(postComplete).toHaveBeenCalledWith({
      messageId: "m_pending",
      content: "The CRM base has Contacts and Deals.",
      status: "complete",
    });
  });

  it("appends the new user message after prior history", async () => {
    const generate = vi.fn(async (_args: { context: string; messages: ChatTurn[] }) => "ok")
    const postComplete = vi.fn(async () => {})
    await runChatRespond(
      {
        ...base,
        history: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
      },
      { generate, postComplete },
    );
    expect(generate.mock.calls[0]![0].messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: base.userMessage },
    ]);
  });

  it("records an error reply when generation throws", async () => {
    const generate = vi.fn(async () => {
      throw new Error("model down");
    });
    const postComplete = vi.fn(async () => {});
    const out = await runChatRespond(base, { generate, postComplete });

    expect(out).toEqual({ ok: false, status: "error" });
    expect(postComplete).toHaveBeenCalledWith({
      messageId: "m_pending",
      content: expect.stringContaining("couldn't generate"),
      status: "error",
    });
  });

  it("filters out non-user/assistant history roles", async () => {
    const generate = vi.fn(async (_args: { context: string; messages: ChatTurn[] }) => "ok");
    const postComplete = vi.fn(async () => {});
    await runChatRespond(
      { ...base, history: [{ role: "system", content: "x" } as unknown as ChatTurn] },
      { generate, postComplete },
    );
    expect(generate.mock.calls[0]![0].messages).toEqual([
      { role: "user", content: base.userMessage },
    ]);
  });
});

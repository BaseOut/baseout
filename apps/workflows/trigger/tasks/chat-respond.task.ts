// Trigger.dev wrapper for runChatRespond (workflows-schema-chat).
//
// Pure orchestration is in ./chat-respond.ts; this wires the Claude call + the
// engine /chat/message-complete POST. Runs on Node (process.env config). Model
// is claude-opus-4-8 per CLAUDE.md; streaming is a follow-up (this returns the
// full reply, then writes it back). Sovereign-AI: only schema metadata + the
// user's messages are sent.

import { task } from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";
import {
  runChatRespond,
  type ChatRespondInput,
  type ChatRespondResult,
  type ChatTurn,
} from "./chat-respond";

export type ChatRespondPayload = ChatRespondInput;

const CHAT_MODEL = "claude-opus-4-8";

const CHAT_SYSTEM =
  "You are a helpful assistant answering questions about a Space's Airtable " +
  "schema. You are given the schema as METADATA ONLY (base/table/field names, " +
  "types, descriptions, and attached doc summaries) — never record data. Answer " +
  "using only this context; if something isn't in the schema, say so. Be concise " +
  "and concrete, referencing entities by name.";

async function generateWithClaude(
  client: Anthropic,
  args: { context: string; messages: ChatTurn[] },
): Promise<string> {
  const res = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system: `${CHAT_SYSTEM}\n\n${args.context}`,
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function postComplete(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  threadId: string,
  args: { messageId: string; content: string; status: "complete" | "error" },
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/spaces/${encodeURIComponent(spaceId)}/chat/message-complete`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-internal-token": internalToken, "content-type": "application/json" },
    body: JSON.stringify({ threadId, ...args }),
  });
  if (res.status === 409 || res.status === 501) return;
  if (!res.ok) throw new Error(`chat message-complete ${res.status}`);
}

export const chatRespondTask = task({
  id: "chat-respond",
  maxDuration: 300,
  run: async (payload: ChatRespondPayload): Promise<ChatRespondResult> => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!engineUrl) throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    if (!internalToken) throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in the Trigger.dev env");

    const client = new Anthropic({ apiKey });

    return runChatRespond(payload, {
      generate: (args) => generateWithClaude(client, args),
      postComplete: (args) =>
        postComplete(engineUrl, internalToken, payload.spaceId, payload.threadId, args),
    });
  },
});

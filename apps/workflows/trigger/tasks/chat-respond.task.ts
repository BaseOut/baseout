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
import { fetchAiCredential, resolveChatClientConfig } from "./_lib/ai-credential";

// The payload carries the org id (shared-ai-byok task 4.1) so the runner can
// fetch that org's AI routing decision + (for byok) the decrypted key at run
// start. It carries NO secret material — the plaintext key is fetched fresh over
// the gated credential endpoint, never serialized onto the payload.
export type ChatRespondPayload = ChatRespondInput & { organizationId: string };

const CHAT_MODEL = "claude-opus-4-8";

const CHAT_SYSTEM =
  "You are a helpful assistant answering questions about a Space's Airtable " +
  "schema. You are given the schema as METADATA ONLY (base/table/field names, " +
  "types, descriptions, and attached doc summaries) — never record data. Answer " +
  "using only this context; if something isn't in the schema, say so. Be concise " +
  "and concrete, referencing entities by name.";

async function generateWithClaude(
  client: Anthropic,
  model: string,
  args: { context: string; messages: ChatTurn[] },
): Promise<string> {
  const res = await client.messages.create({
    model,
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
    if (!engineUrl) throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    if (!internalToken) throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");

    // BYOK routing (task 4.1): fetch the org's decision + (for byok) the
    // decrypted key over the gated credential endpoint, then build the client
    // from the resolved key + model. On the pool path this is identical to
    // before — the env ANTHROPIC_API_KEY + CHAT_MODEL.
    const credential = await fetchAiCredential(
      fetch,
      engineUrl,
      internalToken,
      payload.organizationId,
    );
    const config = resolveChatClientConfig(credential, {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: CHAT_MODEL,
    });
    if (!config.apiKey) {
      // Pool path with no ANTHROPIC_API_KEY (byok always returns a non-empty
      // key or falls back to pool) — same "no key → throw" guard as before.
      throw new Error("No Anthropic API key available (ANTHROPIC_API_KEY unset and no BYOK key)");
    }

    const client = new Anthropic({ apiKey: config.apiKey });

    return runChatRespond(payload, {
      generate: (args) => generateWithClaude(client, config.model, args),
      postComplete: (args) =>
        postComplete(engineUrl, internalToken, payload.spaceId, payload.threadId, args),
    });
  },
});

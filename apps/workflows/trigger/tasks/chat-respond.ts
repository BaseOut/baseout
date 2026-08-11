// Pure orchestration for chat replies (workflows-schema-chat).
//
// The engine assembles the metadata-only context + history at send time and
// enqueues this task; it calls Claude and POSTs the assistant reply back to the
// engine (/chat/message-complete), which flips the pending message to complete.
// Pure (deps injected): generate (Claude) + postComplete (engine POST). Mirrors
// the health-score-base pure/wrapper split. Sovereign-AI: only schema metadata +
// the user's own messages are sent.

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRespondInput {
  spaceId: string;
  threadId: string;
  assistantMessageId: string;
  /** Metadata-only schema/doc context assembled engine-side. */
  context: string;
  /** Prior conversation (excludes the new user message + the pending reply). */
  history: ChatTurn[];
  /** The user message that triggered this turn. */
  userMessage: string;
}

export interface ChatRespondDeps {
  generate: (args: { context: string; messages: ChatTurn[] }) => Promise<string>;
  postComplete: (args: {
    messageId: string;
    content: string;
    status: "complete" | "error";
  }) => Promise<void>;
}

export interface ChatRespondResult {
  ok: boolean;
  status: "complete" | "error";
}

const ERROR_REPLY =
  "Sorry — I couldn't generate a reply just now. Please try again.";

export async function runChatRespond(
  input: ChatRespondInput,
  deps: ChatRespondDeps,
): Promise<ChatRespondResult> {
  const history = input.history.filter(
    (m): m is ChatTurn => m.role === "user" || m.role === "assistant",
  );
  const messages: ChatTurn[] = [
    ...history,
    { role: "user", content: input.userMessage },
  ];

  try {
    const content = await deps.generate({ context: input.context, messages });
    await deps.postComplete({
      messageId: input.assistantMessageId,
      content,
      status: "complete",
    });
    return { ok: true, status: "complete" };
  } catch {
    // Best-effort: record an error reply so the UI stops waiting. If even the
    // postComplete throws, the task retries (the message stays pending).
    await deps.postComplete({
      messageId: input.assistantMessageId,
      content: ERROR_REPLY,
      status: "error",
    });
    return { ok: false, status: "error" };
  }
}

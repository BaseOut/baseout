// Per-Space chat I/O (server-schema-chat).
//
// Runs inside `withSpaceSchema(...)`. Threads + messages persist per-Space (like
// Docs); the AI reply is generated asynchronously in workflows and written back
// via completeAssistantMessage, so the assistant row starts `pending`. Context
// assembly reuses the pure assembleChatContext over the per-Space schema + docs.

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import {
  assembleChatContext,
  type ChatScope,
  type CtxDoc,
} from "./chat-context";

export interface ChatThreadSummary {
  id: string;
  title: string;
  archived: boolean;
  updatedAt: string | null;
}

export interface ChatMessageView {
  id: string;
  role: string;
  status: string;
  content: string;
  createdAt: string | null;
}

export interface ChatThreadDetail {
  id: string;
  title: string;
  archived: boolean;
  scope: ChatScope | null;
  attachedDocIds: string[];
  messages: ChatMessageView[];
}

export async function createThread(
  tx: SpaceTx,
  args: { createdByUserId?: string | null; title?: string },
): Promise<{ id: string }> {
  const now = new Date();
  const inserted = await tx
    .insert(spacePg.chatThreads)
    .values({
      title: args.title ?? "New chat",
      createdByUserId: args.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: spacePg.chatThreads.id });
  return { id: inserted[0]!.id };
}

export async function listThreads(
  tx: SpaceTx,
  opts?: { includeArchived?: boolean },
): Promise<ChatThreadSummary[]> {
  const rows = await tx
    .select({
      id: spacePg.chatThreads.id,
      title: spacePg.chatThreads.title,
      archived: spacePg.chatThreads.archived,
      updatedAt: spacePg.chatThreads.updatedAt,
    })
    .from(spacePg.chatThreads)
    .orderBy(desc(spacePg.chatThreads.updatedAt));
  return rows
    .filter((r) => opts?.includeArchived || !r.archived)
    .map((r) => ({
      id: r.id,
      title: r.title,
      archived: r.archived,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }));
}

export async function getThread(
  tx: SpaceTx,
  threadId: string,
): Promise<ChatThreadDetail | null> {
  const [thread] = await tx
    .select()
    .from(spacePg.chatThreads)
    .where(eq(spacePg.chatThreads.id, threadId))
    .limit(1);
  if (!thread) return null;

  const messages = await tx
    .select({
      id: spacePg.chatMessages.id,
      role: spacePg.chatMessages.role,
      status: spacePg.chatMessages.status,
      content: spacePg.chatMessages.content,
      createdAt: spacePg.chatMessages.createdAt,
    })
    .from(spacePg.chatMessages)
    .where(eq(spacePg.chatMessages.threadId, threadId))
    .orderBy(asc(spacePg.chatMessages.createdAt));

  return {
    id: thread.id,
    title: thread.title,
    archived: thread.archived,
    scope: (thread.scope as ChatScope | null) ?? null,
    attachedDocIds: (thread.attachedDocIds as string[] | null) ?? [],
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      content: m.content,
      createdAt: m.createdAt ? m.createdAt.toISOString() : null,
    })),
  };
}

export async function renameThread(tx: SpaceTx, args: { id: string; title: string }): Promise<boolean> {
  const r = await tx
    .update(spacePg.chatThreads)
    .set({ title: args.title, updatedAt: new Date() })
    .where(eq(spacePg.chatThreads.id, args.id))
    .returning({ id: spacePg.chatThreads.id });
  return r.length > 0;
}

export async function archiveThread(tx: SpaceTx, args: { id: string; archived: boolean }): Promise<boolean> {
  const r = await tx
    .update(spacePg.chatThreads)
    .set({ archived: args.archived, updatedAt: new Date() })
    .where(eq(spacePg.chatThreads.id, args.id))
    .returning({ id: spacePg.chatThreads.id });
  return r.length > 0;
}

export async function setThreadContext(
  tx: SpaceTx,
  args: { id: string; scope: ChatScope | null; attachedDocIds: string[] },
): Promise<boolean> {
  const r = await tx
    .update(spacePg.chatThreads)
    .set({ scope: args.scope, attachedDocIds: args.attachedDocIds, updatedAt: new Date() })
    .where(eq(spacePg.chatThreads.id, args.id))
    .returning({ id: spacePg.chatThreads.id });
  return r.length > 0;
}

/**
 * Append a user message + a pending assistant message in one go (the send turn).
 * Sets the thread title from the first user message when it is still "New chat",
 * and bumps updatedAt. Returns both message ids + the prior history (for the AI).
 */
export async function appendTurn(
  tx: SpaceTx,
  args: { threadId: string; content: string },
): Promise<{
  userMessageId: string;
  assistantMessageId: string;
  history: { role: string; content: string }[];
} | null> {
  const [thread] = await tx
    .select({ id: spacePg.chatThreads.id, title: spacePg.chatThreads.title })
    .from(spacePg.chatThreads)
    .where(eq(spacePg.chatThreads.id, args.threadId))
    .limit(1);
  if (!thread) return null;

  // Prior complete messages = the conversation history for the AI.
  const prior = await tx
    .select({ role: spacePg.chatMessages.role, content: spacePg.chatMessages.content })
    .from(spacePg.chatMessages)
    .where(
      and(
        eq(spacePg.chatMessages.threadId, args.threadId),
        eq(spacePg.chatMessages.status, "complete"),
      ),
    )
    .orderBy(asc(spacePg.chatMessages.createdAt));

  const now = new Date();
  const [userMsg] = await tx
    .insert(spacePg.chatMessages)
    .values({ threadId: args.threadId, role: "user", status: "complete", content: args.content, createdAt: now })
    .returning({ id: spacePg.chatMessages.id });
  const [asstMsg] = await tx
    .insert(spacePg.chatMessages)
    .values({
      threadId: args.threadId,
      role: "assistant",
      status: "pending",
      content: "",
      createdAt: new Date(now.getTime() + 1),
    })
    .returning({ id: spacePg.chatMessages.id });

  const titleUpdate =
    thread.title === "New chat" ? { title: args.content.slice(0, 60) } : {};
  await tx
    .update(spacePg.chatThreads)
    .set({ updatedAt: new Date(), ...titleUpdate })
    .where(eq(spacePg.chatThreads.id, args.threadId));

  return {
    userMessageId: userMsg!.id,
    assistantMessageId: asstMsg!.id,
    history: prior.map((p) => ({ role: p.role, content: p.content })),
  };
}

export async function completeAssistantMessage(
  tx: SpaceTx,
  args: { messageId: string; content: string; status?: "complete" | "error" },
): Promise<boolean> {
  const r = await tx
    .update(spacePg.chatMessages)
    .set({ content: args.content, status: args.status ?? "complete" })
    .where(eq(spacePg.chatMessages.id, args.messageId))
    .returning({ id: spacePg.chatMessages.id });
  return r.length > 0;
}

/**
 * Assemble the metadata-only AI context for a thread: its scoped schema slice +
 * attached doc summaries. Reads the per-Space schema rows + docs and delegates
 * shaping to the pure assembleChatContext.
 */
export async function assembleThreadContext(
  tx: SpaceTx,
  args: { scope: ChatScope | null; attachedDocIds: string[] },
): Promise<string> {
  const [bases, tables, fields] = await Promise.all([
    tx
      .select({ baseId: spacePg.bases.baseId, name: spacePg.bases.name, description: spacePg.bases.description })
      .from(spacePg.bases),
    tx
      .select({
        tableId: spacePg.tables.tableId,
        baseId: spacePg.tables.baseId,
        name: spacePg.tables.name,
        description: spacePg.tables.description,
      })
      .from(spacePg.tables),
    tx
      .select({
        fieldId: spacePg.fields.fieldId,
        tableId: spacePg.fields.tableId,
        baseId: spacePg.fields.baseId,
        name: spacePg.fields.name,
        type: spacePg.fields.type,
        description: spacePg.fields.description,
      })
      .from(spacePg.fields),
  ]);

  let docs: CtxDoc[] = [];
  if (args.attachedDocIds.length > 0) {
    const docRows = await tx
      .select({ title: spacePg.documents.title, excerpt: spacePg.documents.excerpt })
      .from(spacePg.documents)
      .where(inArray(spacePg.documents.id, args.attachedDocIds));
    docs = docRows.map((d) => ({ title: d.title, excerpt: d.excerpt }));
  }

  return assembleChatContext({ scope: args.scope, bases, tables, fields, docs });
}

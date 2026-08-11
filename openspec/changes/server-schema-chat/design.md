## Context

Chat is interactive but the established AI pattern (health scoring) runs Claude in the **workflows** Node runner, not the engine — keeping the backup engine headless + the `ANTHROPIC_API_KEY` out of workerd. Interactive request/response doesn't fit Trigger.dev's batch model directly, so this uses an **async pending-message + poll** model (the same shape as backup-status polling): the engine persists the turn + enqueues the reply; the UI polls until it resolves.

## Goals / Non-Goals

**Goals**
- Persist threads + messages per-Space (consistent with Docs).
- Assemble metadata-only context scoped to bases/tables/fields + attached docs.
- Drive the AI reply through workflows without adding an AI secret to the engine.

**Non-Goals**
- Streaming (the reply is written back whole; the UI polls). A follow-up.
- Credit metering (no credits system wired). Pro+ tier gates it for now.
- Convert-to-doc / clickable references (web follow-ups).

## Decisions

1. **AI in workflows, not the engine.** Reuses the health-scoring pattern + the existing `ANTHROPIC_API_KEY` in the Trigger.dev env; the engine stays AI-secret-free. Cost: async + polling instead of synchronous streaming — acceptable for MVP (the spec allows non-streaming).

2. **Pending-message model.** `/chat/send` inserts the user message (`complete`) + an assistant message (`pending`) in one tx, assembles context, then — after the tx commits — enqueues `chat-respond`. The task POSTs `/chat/message-complete` to set the assistant content + status. On enqueue failure the engine flips the pending message to `error` so the UI doesn't wait forever.

3. **Context is pure + metadata-only.** `assembleChatContext` takes slim rows (no DB) and emits a compact outline (base ▸ table ▸ field: type) + attached doc summaries, capped by `maxFields`. Scope semantics: empty → whole Space; a table is in scope if its base/table is scoped or it holds a scoped field; a field if its base/table/field is scoped. Sovereign-AI: record data never enters the context.

4. **Per-Space storage (v5), reuse bo_at_documents.** Threads/messages live per-Space like Docs; attached-doc context reads `bo_at_documents` (title + excerpt). One v5 bump for both chat tables.

5. **History = prior complete messages.** `appendTurn` snapshots the prior `complete` messages as the AI history before inserting the new turn, so the pending reply + the just-sent user message aren't double-counted. The task appends the new user message to that history.

## Risks / Trade-offs

- **[Risk] Stuck pending message** (task never runs / dies). → enqueue-failure path flips to `error`; the task's own error path also writes an error reply; Trigger.dev retries cover transient failures.
- **[Risk] v4 Spaces lack the tables.** → routes 409/501 or error until re-provision (`system-per-space-upgrade`); dev re-provisions.
- **[Trade-off] Polling latency.** → 2s poll; acceptable for MVP. Streaming is the follow-up.

## Migration Plan

Per-Space v5: new/re-provisioned Spaces get `bo_at_chat_threads` + `bo_at_chat_messages` from the bundled DDL. Existing Spaces: deferred `system-per-space-upgrade`. No master-DB migration. Verified: server `typecheck` + targeted suites; `db-schema` parity 27.

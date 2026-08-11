## Why

The Schema page needs an AI **Chat** tab, but the engine has no chat surface. This change adds persisted chat threads + messages (per-Space, like Docs), metadata-only context assembly (scoped schema slice + attached docs), and the async send/complete plumbing that drives the AI reply through workflows. Pairs with [`workflows-schema-chat`](../workflows-schema-chat/) (the Claude call) + [`web-chat-tab`](../web-chat-tab/) (the UI).

## What Changes

- **Two new per-Space tables** (per-Space schema **v5**): `bo_at_chat_threads` (title, archived, scope, attached docs, owner) + `bo_at_chat_messages` (thread, role, status, content). Assistant messages start `pending` and resolve to `complete`/`error`.
- **Context assembly is metadata-only + pure** (`assembleChatContext`): the scoped schema slice (base/table/field names, types, descriptions — NEVER record data) + attached doc summaries. Sovereign-AI: only metadata leaves the Space.
- **Async reply model.** `/chat/send` appends the user message + a pending assistant message, assembles context, and enqueues the workflows `chat-respond` task; the task POSTs `/chat/message-complete` to resolve the pending message. The UI polls the thread. (No new engine secret — the Claude call lives in workflows, reusing the existing `ANTHROPIC_API_KEY`.)
- **Routes** (all `INTERNAL_TOKEN`-gated): `GET|POST /chat/threads`, `GET|PATCH /chat/threads/:id`, `POST /chat/send`, `POST /chat/message-complete`.

## Capabilities

### New Capabilities
- `schema-chat`: engine storage + read/write for chat threads & messages, metadata-only context assembly, and the async send/complete plumbing for AI replies.

### Modified Capabilities
<!-- Extends the per-Space schema (v5) + adds engine routes. Reuses bo_at_documents for attached-doc context. -->

## Impact

- `apps/server/src/lib/per-space/chat-context.ts` (pure) + `chat-io.ts` (thread/message I/O + context read).
- Routes: `chat-threads.ts`, `chat-thread.ts`, `chat-send.ts`, `chat-message-complete.ts` + `index.ts` wiring; `trigger-client.ts` `enqueueChatRespond`.
- `packages/db-schema/src/space/{pg,sqlite}.ts` — `bo_at_chat_threads` + `bo_at_chat_messages`; `SPACE_SCHEMA_VERSION` 4→5; squashed migrations + `pg-ddl.ts` regenerated; parity → 27 tables.
- **Migration:** new/re-provisioned Spaces get the tables from the bundled DDL; existing Spaces need the deferred [`system-per-space-upgrade`](../system-per-space-upgrade/) (dev re-provisions).
- **Security:** new internal routes only (`INTERNAL_TOKEN`-gated); the AI call + `ANTHROPIC_API_KEY` stay in workflows (no new engine secret); context is metadata-only (no record data). Pro+ gating + credit metering are enforced web-side (`web-chat-tab`); credit debit is a follow-up (no credits system wired yet).

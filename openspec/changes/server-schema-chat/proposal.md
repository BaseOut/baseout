## Why

Customers want to ask questions about their schema conversationally. A **Chat** feature lets them have AI discussions about a Space's schema, **scope** the AI's context to specific bases/tables/fields, pull in **existing docs** as reference, and capture a useful conversation as a **Doc**.

## What Changes

- Introduce **chat threads + messages** per Space (`bo_at_chat_threads`, `bo_at_chat_messages`).
- **Scoped context**: a thread's context can be narrowed to specific bases/tables/fields (the standard filter selection) so only that schema slice is sent to the AI (`bo_at_chat_context_entities`).
- **Docs in context**: existing docs can be loaded into a thread's context for the AI to reference (`bo_at_chat_doc_links`, relation `context`).
- **Convert conversation → Doc**: summarize a thread into a new Doc (creates a `bo_at_documents` row, Docs feature), and link it back into the chat as a referenced doc (`bo_at_chat_doc_links`, relation `generated`) with a chat marker message.
- Chat is a **synchronous AI** flow: an engine endpoint assembles the scoped context (schema slice + context docs + thread history), calls the LLM, persists the assistant message, and debits credits. Pro+.

## Capabilities

### New Capabilities
- `schema-chat`: the threads/messages data model, the scoped-context chat flow (entity scoping + AI inference + persistence + credits), and thread management.
- `chat-doc-integration`: loading existing docs into a thread's context window, and converting a conversation into a new Doc with a linked reference back in the chat.

### Modified Capabilities
<!-- New capabilities; reuses bo_at_documents (Docs) + bo_at_* entities from the unarchived system-per-space-db. -->

## Impact

- **Per-Space DB**: `bo_at_chat_threads`, `bo_at_chat_messages`, `bo_at_chat_context_entities`, `bo_at_chat_doc_links`. Reuses `bo_at_documents` (Docs feature).
- **apps/server**: chat endpoint (context assembly + synchronous AI), convert-to-doc, context-doc management; per-Space reads/writes brokered by the engine.
- **credits**: per chat turn + per convert-to-doc, via `credit_transactions`.
- **UI**: paired ui-only change `chat-tab`.
- **Cross-references**: `system-per-space-db` (`bo_at_*` entities + `bo_at_documents`), the Docs model + tagging, `web/data-intelligence-ui` (Cloudflare AI + credits precedent), Browse (the filter menus reused for scoping), the shared entity sidebar (click-through).
</content>

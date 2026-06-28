## 1. Per-Space DB

- [ ] 1.1 Add `bo_at_chat_threads`, `bo_at_chat_messages`, `bo_at_chat_context_entities`, `bo_at_chat_doc_links` (`relation` context|generated) to `packages/db-schema/src/space/{pg,sqlite}.ts`; bump `SPACE_SCHEMA_VERSION`; regenerate; keep parity test green. (Reuses `bo_at_documents`.)

## 2. Chat flow (apps/server) — `schema-chat`

- [ ] 2.1 Thread + message CRUD endpoints (create/list/get/rename/archive); archived excluded from default list.
- [ ] 2.2 Context scoping endpoints: set/clear `bo_at_chat_context_entities` for a thread (base/table/field).
- [ ] 2.3 Chat turn: assemble context (scoped schema slice from `bo_at_*`; default whole Space if none) + `context` docs + thread history → synchronous LLM call (optional streaming) → persist assistant message → debit credits via `credit_transactions`. Pro+.

## 3. Doc integration (apps/server) — `chat-doc-integration`

- [ ] 3.1 Attach/detach existing docs to a thread (`bo_at_chat_doc_links` relation `context`); attached docs join the context window.
- [ ] 3.2 Convert-to-doc: summarize the thread → create `bo_at_documents` (Plate format) + auto-tag scoped entities (`bo_at_document_tags`) + `bo_at_chat_doc_links` relation `generated` + a `system` marker message linking it; debit credits.
- [ ] 3.3 Ensure `generated` docs are linked-but-not-auto-fed as context (only `context` relation feeds the window).

## 4. Tiering + cross-refs

- [ ] 4.1 Pro+ gating on chat + convert-to-doc; flag the sovereign AI-context consideration for the residency follow-up.
- [ ] 4.2 Cross-reference `system-per-space-db` (`bo_at_*` + `bo_at_documents`), the Docs model + tagging, Browse (filter menus for scoping), the shared entity sidebar. Link the ui-only `chat-tab`.

## 5. Verification

- [ ] 5.1 Demo: start a thread, scope to a table, ask a question → assistant answers from that table's schema only; credits debited.
- [ ] 5.2 Demo: attach an existing doc → assistant references it; convert the conversation to a doc → a new doc is created (tagged with scoped entities) and a linked reference appears in the chat.
</content>

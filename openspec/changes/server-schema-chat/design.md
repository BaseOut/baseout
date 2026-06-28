## Context

Chat is an AI conversation about a Space's schema. Unlike the batch AI features (scoring, insights — Trigger.dev tasks), chat is **interactive/synchronous**: a turn is request→response, like the "Generate description" synchronous Cloudflare AI call. It reads the per-Space schema (`bo_at_*`) and docs (`bo_at_documents`, Docs feature), scopes context to a user-selected entity set, and can spawn a Doc. Lives in the per-Space DB (travels with posture). Reuses Browse's filter menus (scoping), the Docs model, and the shared entity sidebar.

## Goals / Non-Goals

**Goals**
- Persisted chat threads + messages per Space.
- Context scoping to specific bases/tables/fields (standard filter selection).
- Load existing docs into the context window; convert a conversation into a Doc with a linked reference.
- Credit-debited, Pro+.

**Non-Goals**
- A general assistant beyond schema (scope is the Space's schema + attached docs).
- Trigger.dev orchestration (chat is synchronous; convert-to-doc is a short synchronous summarize).
- Cross-Space chat.

## Decisions

### Data model (per-Space DB)
- `bo_at_chat_threads`: `id`, `title`, `status` (`active` | `archived`), `created_by_user_id`, `created_at`, `updated_at`.
- `bo_at_chat_messages`: `id`, `thread_id`, `role` (`user` | `assistant` | `system`), `content` (markdown), `created_at`. (System/marker messages carry doc references, e.g. "Converted to doc …".)
- `bo_at_chat_context_entities`: `thread_id`, `entity_type` (`base` | `table` | `field`), `entity_id` — the scoped context selection.
- `bo_at_chat_doc_links`: `thread_id`, `document_id` (→ `bo_at_documents`), `relation` (`context` = loaded for the AI to reference | `generated` = created by converting this conversation).

### Chat turn (synchronous, engine endpoint)
On a user message the engine: (1) assembles context = the **scoped** entities' schema slice (only the selected bases/tables/fields from `bo_at_*`; default = whole Space if none selected) + the content of `context` docs + the thread's prior messages; (2) calls the LLM (optionally streaming); (3) persists the user + assistant messages; (4) debits credits. Not a Trigger.dev task — request/response (with streaming).

### Doc integration
- **Add existing doc to context**: insert a `bo_at_chat_doc_links` (relation `context`); its content joins the context window on subsequent turns.
- **Convert conversation → Doc**: summarize the thread into Doc (Plate) format via a synchronous AI call → create a `bo_at_documents` row (auto-tagging the thread's scoped entities via `bo_at_document_tags`) → add a `bo_at_chat_doc_links` (relation `generated`) → append a `system` chat message linking the new doc. The chat then shows a **linked reference** to that doc.

### Tiering & governance
- AI chat + convert-to-doc debit credits → **Pro+** (consistent with scoring/insights/generate-description).
- The scoped schema slice + attached docs are sent to the LLM; for **sovereign** Spaces this is the same AI-sees-your-content consideration as scoring/insights — chat for sovereign uses the managed AI only with that understood (or is disabled per the residency contract). Flag for the residency follow-up.

## Risks / Trade-offs

- **[Risk] Context window blowout** with a large schema / many docs. → Scope selection narrows it; cap the included slice + doc count; summarize older turns if needed.
- **[Risk] Cost of long conversations.** → Per-turn credit debit; context scoping keeps tokens down; Pro+.
- **[Trade-off] Synchronous vs task.** → Chat is request/response (streaming) in the engine, not Trigger.dev; convert-to-doc is a short synchronous summarize. Consistent with the Generate-description precedent.
- **[Trade-off] Sovereign + AI.** → Same posture consideration as other AI features; documented, gated.
</content>

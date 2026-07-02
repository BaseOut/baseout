## Status

Web half of Chat — DONE + green. Thread list + conversation + composer with async
reply polling over `server-schema-chat`. Pro+ gated via the `manual_ai` Schema Docs
level. No DB/migration/capability-key change.

---

## 1. Web client + proxy routes — DONE

- [x] 1.1 `backup-engine.ts` — `listChatThreads` / `createChatThread` / `getChatThread` / `patchChatThread` / `sendChatMessage` + view types (`ChatThreadSummaryView` / `ChatMessageView` / `ChatThreadDetailView` / results).
- [x] 1.2 Proxy routes (all guarded + Pro+ `manual_ai` → else 403 `chat_not_entitled`): `chat/threads.ts` (GET list / POST create), `chat/threads/[threadId].ts` (GET / PATCH rename·archive·context), `chat/send.ts` (POST). Tests: `chat/threads.test.ts` (5) + `chat/send.test.ts` (4) + `chat/threads/[threadId].test.ts` (4).

## 2. Chat tab UI — DONE

- [x] 2.1 `SchemaView.astro` — "Chat" radio tab (last). Pro+ gate: `!aiEnabled` → upgrade affordance; `!hasSchema` → empty state; else the two-pane chat (thread list + conversation + composer). Lazy-load threads on first open.
- [x] 2.2 Send flow: optimistic user bubble + pending assistant bubble (daisyUI `chat`), POST `/chat/send`, then poll the thread every 2s until no message is `pending` (stops on resolve); titles refresh from the first message. New-chat + thread-select wired. Context bar shows "Whole Space" (scoped controls deferred).

## 3. Verification

- [x] 3.1 web `typecheck` 0 errors + `build` green + full unit suite **939** green (incl. the 13 new chat proxy tests). No stray `console.*`.
- [ ] 3.2 Human smoke: Pro+ Space → `/schema` → Chat → new chat → ask a question → pending bubble resolves to a reply; non-Pro+ sees the upgrade affordance. Needs `npx trigger.dev dev` + `ANTHROPIC_API_KEY` + engine `--remote`; v5 Space (re-provision existing).

## Deferred follow-ups

- [ ] Scoped-context controls (entity-filter chips via the field filter + doc picker) — engine `setThreadContext` exists; UI shows "Whole Space".
- [ ] Convert-to-doc + clickable entity/doc references in replies.
- [ ] Rename / archive UI controls (engine `patchChatThread` exists).
- [ ] Streaming replies.

## 4. Follow-ups (DONE)

- [x] 4.1 Rename + Archive controls on the open thread (PATCH `chat/threads/:id` title/archived); archive clears the conversation + refreshes the list.
- [x] 4.2 Base-scope context selector (`#chat-scope` → PATCH `scope:{baseIds:[base]}` or null for Whole Space); the engine includes only that base's schema slice on the next turn. Field-level scope picker + attached-doc picker still deferred.
- [ ] (still deferred) Convert-to-doc (needs a new engine route + Plate body shaping), clickable entity/doc refs in replies, streaming.

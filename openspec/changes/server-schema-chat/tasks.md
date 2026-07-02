## Status

Engine half of the Chat tab — DONE + green. Per-Space **v5** (threads + messages);
metadata-only context; async send → workflows reply → complete. Pairs with
`workflows-schema-chat` + `web-chat-tab`.

---

## 1. Pure logic (TDD) — DONE

- [x] 1.1 `assembleChatContext` (`chat-context.ts`) — scope filtering (base/table/field; field-scope pulls its table), whole-Space default, attached-doc summaries, `maxFields` cap, descriptions. Tests `tests/integration/per-space/chat-context.test.ts` (7).

## 2. Data model + migration — DONE

- [x] 2.1 `bo_at_chat_threads` + `bo_at_chat_messages` in BOTH dialects; `SPACE_SCHEMA_VERSION` 4→5. Squashed migrations + bundled `pg-ddl.ts` regenerated; parity → **27 tables** (5/5 green).
- [x] 2.2 New/re-provisioned Spaces get the tables from the bundled DDL. **FOLLOW-UP:** existing-Space v4→v5 in-place upgrade = `system-per-space-upgrade`.

## 3. I/O + routes — DONE

- [x] 3.1 `chat-io.ts`: createThread / listThreads (excl. archived) / getThread (+messages) / renameThread / archiveThread / setThreadContext / appendTurn (user + pending assistant, snapshots history, sets title from first message) / completeAssistantMessage / assembleThreadContext (reads schema + docs → assembleChatContext).
- [x] 3.2 Routes: `GET|POST /chat/threads`, `GET|PATCH /chat/threads/:id`, `POST /chat/send` (append + enqueue + error-on-enqueue-fail), `POST /chat/message-complete` (workflows target). Registered in `index.ts`; `trigger-client.enqueueChatRespond`. Route-guard tests `spaces-chat-route.test.ts` (14).

## 4. Verification

- [x] 4.1 server `typecheck` + `build` green; chat-route + chat-context + relationships/schema-mirrors/runs-start batch green (79); `db-schema` parity 27; workflows full 196 (incl. chat-respond). No stray `console.*`. **Security:** AI + `ANTHROPIC_API_KEY` stay in workflows (no new engine secret); context metadata-only; `INTERNAL_TOKEN`-gated routes.
- [ ] 4.2 Human smoke (with task + UI): on a **v5** managed_pg Space, create a thread, send a message → pending reply resolves via the task; rename/archive work; metadata-only context confirmed. Needs `npx trigger.dev dev` + `ANTHROPIC_API_KEY` in the Trigger.dev env + engine `--remote`. Existing Spaces need re-provision.

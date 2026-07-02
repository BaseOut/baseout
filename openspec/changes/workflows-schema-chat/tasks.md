## Status

Workflows half of Chat — DONE + green. The Claude call for chat replies; pairs
with `server-schema-chat` (storage + context + enqueue).

---

## 1. Pure orchestration (TDD) — DONE

- [x] 1.1 `runChatRespond(input, deps)` (`chat-respond.ts`) — build messages (history + new user turn, filtering non-user/assistant roles), `generate`, `postComplete` (complete); on error write an `error` reply. Tests `tests/chat-respond.test.ts` (4).

## 2. Task wrapper — DONE

- [x] 2.1 `chat-respond.task.ts` — Anthropic (`claude-opus-4-8`), metadata-only system prompt + engine context, non-streaming; `postComplete` POSTs `/chat/message-complete` (409/501 → no-op). Reads `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` + `ANTHROPIC_API_KEY` from `process.env`. `id: "chat-respond"`, `maxDuration: 300`.
- [x] 2.2 Type re-exports in `trigger/tasks/index.ts` (`chatRespondTask`, `ChatRespondPayload`, result/input/turn types).

## 3. Verification

- [x] 3.1 `pnpm --filter @baseout/workflows test` green (196, incl. the 4 new); `typecheck` clean. No stray `console.*`. Reuses the existing `ANTHROPIC_API_KEY` (no new secret).
- [ ] 3.2 Human smoke: with the UI + `npx trigger.dev dev`, sending a message produces a reply (pending → complete); a forced model error yields the error reply.

## Deferred

- [ ] Stream the reply (currently returns whole, then writes back).

## Why

The engine supports AI chat about a Space's schema ([`server-schema-chat`](../server-schema-chat/) + [`workflows-schema-chat`](../workflows-schema-chat/)) — persisted threads, scoped context, async replies — but nothing surfaces it. The ui-only [`chat-tab`](../../../) spec defines a **Chat** tab on the Schema page (thread list + conversation + composer). This change adds that tab.

## What Changes

- A new **Chat** tab on `/schema` (last in the tab order). A thread list (new chat + select), a conversation view (user/assistant bubbles), and a composer.
- **Async replies via polling**: sending a message shows the user bubble + a pending assistant bubble; the tab polls the thread until the reply resolves (mirrors the backup-status polling pattern).
- **Pro+ gating** — Chat is AI, so the proxy requires the `manual_ai` Schema Docs level (Pro+); below Pro+ the tab shows an upgrade affordance instead of a composer.
- New web client methods (`listChatThreads` / `createChatThread` / `getChatThread` / `patchChatThread` / `sendChatMessage`) + proxy routes under `/api/spaces/:id/chat/*`.

## Capabilities

### New Capabilities
- `chat-tab`: the Chat tab UI — thread list + conversation + composer, async reply polling, Pro+ gating.

### Modified Capabilities
<!-- Adds the last tab to the Schema page; consumes server-schema-chat. No new DB/migration/capability-key (gates via the manual_ai Schema Docs level). -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — chat client methods + view types.
- Proxy routes: `pages/api/spaces/[spaceId]/chat/threads.ts` (GET/POST), `chat/threads/[threadId].ts` (GET/PATCH), `chat/send.ts` (POST) — all guarded + Pro+ (`manual_ai`).
- [`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — the Chat tab (thread list + conversation + composer + polling), with the Pro+ upgrade affordance + no-schema empty state.
- **Pairs with** `server-schema-chat` + `workflows-schema-chat`.
- **Deferred follow-ups:** scoped-context controls (entity-filter chips + doc picker — the engine `setThreadContext` exists, the UI shows "Whole Space" for now), convert-to-doc, clickable entity/doc references, rename/archive UI controls (engine `patchChatThread` exists), and streaming. No DB/migration/capability-key change.

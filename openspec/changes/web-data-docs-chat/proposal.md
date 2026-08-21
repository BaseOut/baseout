# web-data-docs-chat — Proposal

## Why

The Data page ships six tabs. Four are real ([`web-data-page`](../web-data-page/): Records, Attachments, Changelog, and Comments via [`server-comments-read`](../server-comments-read/)). **Two are `SoonTab` placeholders** — `DataView.astro:166` ("Data docs are on its way") and `:174` ("Data chat is on its way").

**The fork ships both as built.** `ui-only@986f6c09`'s `DataView.astro` renders `<SchemaDocs …/>` on the `docs` panel and `<SchemaChat …/>` on the `chat` panel, plus a `<QuickAskDock …/>` launcher — the *same* Docs and Chat surfaces Schema already has, scoped to records instead of tables. A `dataToSchema.ts` adapter reshapes the Data index into the shape those two components read.

**And both backends already exist.** Nothing new has to be built on the engine:

| surface | engine routes | web state |
|---|---|---|
| Docs | `spaces/documents.ts` · `spaces/document.ts` · `spaces/docs-by-entity.ts` | live on Schema (`views/schema/DocsTab.astro`) |
| Chat | `spaces/chat-send.ts` · `spaces/chat-threads.ts` · `spaces/chat-thread.ts` · `spaces/chat-message-complete.ts` | live on Schema ([`web-chat-tab`](../web-chat-tab/) — **DONE**, incl. the Pro+ `manual_ai` proxy gate) |

So this is the cheapest un-gating in the promotion program: two working surfaces, two working backends, one missing adapter and two panel mounts. The gate is honest today but it is honest about a gap that no longer exists.

## What Changes

- **`DataView.astro` — the two `SoonTab` panels are replaced by real components**, mounted behind the *same* `managed_pg` / dynamic-mode honest gates the sibling tabs already use. The fork's `LockedTab` copy is adopted verbatim for the static-Space case ("Data chat needs a dynamic backup"), so a static Space still gets a true statement rather than a "soon".
- **`components/data/dataToSchema.ts` promoted from the fork** — the adapter that maps `bases`/`tables`/`records`/`views` into the `SchemaDoc`/index shape `SchemaDocs` and `SchemaChat` consume. This is the one net-new module.
- **Docs and Chat are reached through apps/web's EXISTING Schema implementations**, not the fork's `components/schema/SchemaDocs.astro` / `SchemaChat.astro`. apps/web already has working `views/schema/DocsTab.astro` + `ChatTab.astro` on real data; per the standing ruling those stay and are *parameterised* for a data scope (a `scope: 'schema' | 'data'` prop + `noun`), not rebuilt. The fork's Schema component re-architecture is out of scope here and stays with [`web-schema-app-rearchitecture`](#) (unscheduled — see `ui-sync.md` §4).
- **`QuickAskDock` is deferred**, not gated: it is a *global* chat launcher that belongs to the app shell, and mounting it from the Data page only would put a shell control on one route. Filed as a task in the Schema re-arch change instead. Data's Chat tab is reachable from its own tab, which is the whole requirement.
- **`data.astro` SSR-loads page-1 docs + threads** through the existing `backup-engine` methods (`listDocuments` / `listChatThreads`), space-wide, mapped by the existing `lib/data-browse/map.ts` family.
- **No new engine route, no new proxy, no migration, no new capability key.** Entitlement behaviour is inherited: Docs rides the Schema Docs level, Chat rides Pro+ `manual_ai` and returns the existing `403 chat_not_entitled`.

## Capabilities

### New Capabilities

- `data-app-layer`: the Data page's Docs and Chat tabs render real documents and real chat threads scoped to records, reusing the Schema implementations of both and the engine routes that already back them.

### Modified Capabilities

- `web-data-page`: its two remaining `SoonTab` gates are retired. The tab set, DOM ids, `data-panel` keys, and every other tab's wiring are unchanged.
- `web-chat-tab`: its Chat surface gains a second scope (`data`) behind the same Pro+ gate. No change to the thread/message contract.

## Impact

- **App:** `apps/web` only. `views/DataView.astro` (two panel mounts), `views/schema/{DocsTab,ChatTab}.astro` (a `scope`/`noun` prop — additive, Schema's call site keeps today's behaviour), new `components/data/dataToSchema.ts` + tests, `pages/data.astro` (two SSR loads).
- **Governance:** `dataToSchema.ts` is a `.ts` helper, so no story/classification entry is required; no new `.astro` view, so no raw-markup allowlist entry. `pnpm --filter @baseout/web audit:components` must stay exit 0.
- **No engine change**, therefore no paired `server-*` change. Cross-references: [`server-schema-chat`](../server-schema-chat/) and [`shared-schema-docs`](../shared-schema-docs/) own the backends being consumed.
- **Security:** no new surface. Both proxies already enforce IDOR + tier via `guardSchemaDocsRequest`; the data scope adds no new parameter that reaches the engine unvalidated.

## Open Questions

None blocking. One judgement recorded for the reviewer: the fork reuses *one* pair of components for both scopes, whereas apps/web reaches the same result by adding a scope prop to its own pair. That is a deliberate deviation on "don't rebuild what works" grounds and is the only place this change departs from fork-verbatim.

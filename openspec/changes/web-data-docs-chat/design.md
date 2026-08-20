# web-data-docs-chat — Design

## Context

Two `SoonTab` panels in `views/DataView.astro` are the only remaining gates on the Data page. Both surfaces exist and work on Schema; both engine backends exist. The design question is therefore **not** "how do we build Docs and Chat" — it is "how do we give the working Schema implementations a second scope without disturbing the first."

Three constraints shape the answer:

1. **The standing ruling.** apps/web's `views/schema/DocsTab.astro` and `ChatTab.astro` work on real data. They are not rebuilt from the fork's `components/schema/SchemaDocs.astro` / `SchemaChat.astro`; the fork's Schema component re-architecture is a separate, unscheduled change (`ui-sync.md` §4).
2. **`ChatTab`'s client script is `document`-scoped and single-instance.** `ChatTab.astro:85` resolves `document.querySelector('[data-chat-tab]')`. That is safe (Schema and Data are separate routes, never co-rendered) but it means **scope cannot be passed by closure** — the inline script needs it off a DOM attribute, exactly as `inbox-client.ts` reads `data-as-page`.
3. **`DocsTab` is a React island** (`components/islands/DocsTab`, `client:visible`). Its props are serialised, so the scope must be a plain serialisable value.

## Goals / Non-Goals

**Goals**
- Data ▸ Docs renders real documents scoped to records; Data ▸ Chat holds real threads scoped to records.
- Schema ▸ Docs and Schema ▸ Chat render byte-identically to today.
- Static / non-`managed_pg` Spaces get the fork's honest `LockedTab` statement, not a "soon".

**Non-Goals**
- `QuickAskDock` (a global shell launcher — belongs to the app shell, filed with the Schema re-arch).
- The fork's Schema component re-architecture.
- Any change to the documents or chat engine contracts.

## Decisions

### D1 — Scope is a prop with a `schema` default, carried into the DOM

`DocsTab.astro` and `ChatTab.astro` each gain:

```ts
scope?: 'schema' | 'data'   // default 'schema'
noun?: string              // default derived from scope: 'schema' | 'data'
```

`ChatTab.astro` renders it as `data-chat-scope={scope}` on the existing `[data-chat-tab]` element, and the inline script reads it there. Defaulting to `'schema'` means **Schema's two call sites change by zero characters** — the safest possible shape for a live surface, and the same backward-compatible-prop pattern the Inbox promotion used for `asPage` (`ui-sync.md` §4).

*Rejected:* duplicating the two tab files into `views/data/`. It doubles a live surface's maintenance for one differing string and is precisely the "rebuild what works" the ruling forbids.

### D2 — `dataToSchema.ts` is promoted from the fork and is the only net-new module

The fork's adapter is the seam between the Data page's index (`bases`/`tables`/`records`/`views`) and the entity shape the Docs island's `entities` prop and the chat context picker read. Promote it verbatim (DOM-type-shadow reconciles only, per the standing pattern), with unit tests — the fork ships it untested.

### D3 — Gating mirrors the sibling tabs exactly, using the fork's copy

Docs and Chat sit behind the same two honest gates the Comments/Changelog/Attachments tabs already use, and the fork's `LockedTab` strings are adopted verbatim:

| condition | Docs | Chat |
|---|---|---|
| no data yet | existing Data zero-state | existing Data zero-state |
| static Space (`!isDynamic`) | `LockedTab` | `LockedTab` — "Data chat needs a dynamic backup" |
| not entitled | Schema Docs level gate (existing) | Pro+ `manual_ai` → existing `403 chat_not_entitled` |

No new capability key. The entitlement decision stays server-side in the proxies; the tab renders whatever the guard allows.

### D4 — SSR loads page-1 only, space-wide

`pages/data.astro` calls the existing `listDocuments` / `listChatThreads` engine methods once, space-wide, and passes the results down — the same shape `pages/schema.astro` already uses. No new proxy: the tabs' own client scripts already talk to the existing `/api/spaces/:spaceId/{documents,chat/*}` routes.

## Risks

- **The `[data-chat-tab]` single-instance selector** is a latent trap if a future page co-renders Schema and Data. Mitigation: the design note above, plus the selector stays `document`-scoped rather than being widened — widening it invites the multi-instance bug it currently cannot have.
- **Docs island hydration.** `client:visible` on a `hidden` panel does not intersect, so the island hydrates on first tab reveal. That behaviour is inherited, not introduced — but it must be re-verified on the Data route, because the Data page's panels are shown by a different tab controller than Schema's.

## Migration

None. No schema change, no route change, no data migration. `DataView`'s `data-panel="docs"` / `data-panel="chat"` keys are unchanged, so the tab controller, deep links, and any `wireViewState` work land on the same addresses.

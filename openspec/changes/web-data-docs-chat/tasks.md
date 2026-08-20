## Status

PROPOSED — 0/14. **Unblocked**: both engine backends exist (`spaces/documents`, `spaces/document`, `spaces/docs-by-entity`, `spaces/chat-*`) and both surfaces are live on Schema. No paired `server-*` change.

Sequencing: independent of the other promotion changes — can land any time. Cheapest remaining un-gating in the program.

---

## 1. The adapter (TDD)

- [ ] 1.1 Promote `components/data/dataToSchema.ts` from `ui-only@252005be` verbatim (`git show ui-only/main:apps/web/src/components/data/dataToSchema.ts`). DOM-type-shadow reconciles only, per the standing pattern (`ParentNode`→`HTMLElement`, variadic `.append`→`appendChild` loops).
- [ ] 1.2 Unit tests (`components/data/dataToSchema.test.ts`): base/table/record → entity mapping; view groups; empty inputs; a record with no parent table (defensive drop, not throw). The fork ships this untested — the tests are ours.

## 2. Scope prop on the two live tabs (additive, `schema` default)

- [ ] 2.1 `views/schema/DocsTab.astro` — add `scope?: 'schema' | 'data'` (default `'schema'`) + `noun?: string`, thread `scope` into the island's props and into `ExportControl`'s `noun`. **Schema's call site in `SchemaView.astro` changes by zero characters** — assert this in review.
- [ ] 2.2 `views/schema/ChatTab.astro` — same two props; render `data-chat-scope={scope}` on the existing `[data-chat-tab]` element and read it in the inline script (do NOT widen the `document.querySelector` to a multi-instance query — see design D1/Risks). Empty-state copy switches on `noun`.
- [ ] 2.3 Verify Schema ▸ Docs and Schema ▸ Chat render identically to `HEAD` (diff the rendered panel markup, not just a screenshot).

## 3. Un-gate the two Data panels

- [ ] 3.1 `views/DataView.astro` — replace the `data-panel="docs"` `SoonTab` with `DocsTab` behind the Docs-level gate, and a `LockedTab` for the static-Space case using the fork's verbatim copy. `data-panel` key unchanged.
- [ ] 3.2 `views/DataView.astro` — same for `data-panel="chat"`: `ChatTab` with `scope="data"`, `LockedTab` ("Data chat needs a dynamic backup") on static Spaces. `data-panel` key unchanged.
- [ ] 3.3 `pages/data.astro` — SSR-load page-1 docs (`listDocuments`) + chat threads (`listChatThreads`), space-wide, and pass them down. No new proxy route.
- [ ] 3.4 Confirm `SoonTab.astro` still has a consumer (`SchemaView.astro` Automations/Interfaces) — it does until [`web-automations-interfaces-tabs`](../web-automations-interfaces-tabs/) lands. Do not delete it here.

## 4. Governance + gates

- [ ] 4.1 `pnpm --filter @baseout/web audit:components` exit 0. No new `.astro` component → no classification/story entry needed; no new view → no raw-markup allowlist entry. Confirm rather than assume.
- [ ] 4.2 No stray `console.*` / `debugger` in the diff (CLAUDE.md §3.5).
- [ ] 4.3 `pnpm --filter @baseout/web typecheck` + `test:unit` (targeted: `dataToSchema`) + `build` green.

## 5. Verification

- [ ] 5.1 Demo (dynamic managed_pg Space with a backup): `/data` → **Docs** tab → real documents list, create/tag/link work, export control present; **Chat** tab → thread list, new chat, a real assistant reply arrives via the existing poll.
- [ ] 5.2 Demo (static Space): both tabs show the `LockedTab` statement — not a "soon", not an error.
- [ ] 5.3 Demo (non-Pro org): Chat shows the existing Pro gate; the proxy returns `403 chat_not_entitled` rather than a blank panel.
- [ ] 5.4 Regression: `/schema` ▸ Docs and ▸ Chat unchanged; the Docs island still hydrates on first reveal on **both** routes (different tab controllers — design Risks).
- [ ] 5.5 Mobile at <375 / <768 / <1024 on both tabs (CLAUDE.md §4.3).
- [ ] 5.6 Update `shared/internal/ui-sync.md` §4 (Data page row: Docs/Chat → REAL) in this change (§3.7 discipline).

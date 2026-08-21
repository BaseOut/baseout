## Status

IMPLEMENTED — web half of Slice A Tasks 9–11 on `autumn/cursor-ui-implementation-test`. Engine backends already existed; Schema Docs/Chat reused with additive `scope`/`noun`.

Sequencing: landed with Comments tab (Task 9) on the same branch after `server-comments-read` + comments proxy.

---

## 1. The adapter (TDD)

- [x] 1.1 Promote `components/data/dataToSchema.ts` from ui-only and retarget at apps/web `DocsTabEntity` / ChatTab healthBases (fork SchemaCanvas / schemaEntities not promoted — standing ruling).
- [x] 1.2 Unit tests (`components/data/dataToSchema.test.ts`): base/table/field (+ optional views) mapping; empty inputs; orphan record defensive drop (no throw; records are not Docs targets).

## 2. Scope prop on the two live tabs (additive, `schema` default)

- [x] 2.1 `views/schema/DocsTab.astro` — add `scope?: 'schema' | 'data'` (default `'schema'`) + `noun?: string`, thread into island + ExportControl. **Schema call site unchanged.**
- [x] 2.2 `views/schema/ChatTab.astro` — same; `data-chat-scope={scope}` on `[data-chat-tab]`; empty-state copy switches on `noun`. Selector not widened.
- [x] 2.3 Schema ▸ Docs / Chat keep default props (zero call-site character change in `SchemaView.astro`).

## 3. Un-gate the two Data panels

- [x] 3.1 `views/DataView.astro` — Docs SoonTab → DocsTab (`scope="data"`) + LockedTab/EmptyState gates. `data-panel` key unchanged.
- [x] 3.2 `views/DataView.astro` — Chat SoonTab → ChatTab (`scope="data"`) + LockedTab ("Data chat needs a dynamic backup"). Pro+ inherited.
- [x] 3.3 `pages/data.astro` — SSR `listDocuments` + `listChatThreads`; pass docs/entities/healthBases/docsLevel/aiEnabled.
- [x] 3.4 `SoonTab.astro` still consumed by Schema Automations/Interfaces — not deleted.

## 4. Governance + gates

- [x] 4.1 `pnpm --filter @baseout/web audit:components` exit 0.
- [x] 4.2 No stray `console.*` / `debugger`.
- [x] 4.3 Targeted vitest (`dataToSchema` + data-browse + comments proxy) green; audit:components green.

## 5. Verification

- [ ] 5.1 Demo (dynamic managed_pg Space): `/data` → Docs + Chat real.
- [ ] 5.2 Demo (static Space): LockedTab on both.
- [ ] 5.3 Demo (non-Pro): Chat Pro gate / `403 chat_not_entitled`.
- [ ] 5.4 Regression: `/schema` ▸ Docs/Chat unchanged.
- [ ] 5.5 Mobile breakpoints.
- [x] 5.6 `shared/internal/ui-sync.md` §4 Data row → all tabs REAL.

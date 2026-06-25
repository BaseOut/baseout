## Status

Promotes the per-Space **Schema Docs** storage (shipped in `1e21300`, `SPACE_SCHEMA_VERSION=2`) into a served V1 capability: spec reconciliation + engine broker + web Browse/Docs UI with Plate + React Flow islands, tier-gated Launch+/Pro+. AI generation is gated "soon" (follow-up `server-schema-ai-docs`).

Build order de-risks the React work by proving the full data path SSR-only first (Phase 4), then adding islands (Phase 5).

Precondition (done, not re-specced here): `packages/db-schema/src/space/{pg,sqlite}.ts` document tables.

---

## 1. Spec / doc reconciliation (no code)

- [x] 1.1 `shared/Baseout_PRD.md` §3.7 — split scope: user-authored Schema Docs = V1 (Launch+ manual, Pro+ AI); auto-generated data dictionaries + exports = V2. Added the rich-editor carve-out note (Plate + React Flow sanctioned third-party islands, `client:visible` only).
- [x] 1.2 `shared/Baseout_Features.md` §1 — added a "Schema Documentation Terms" subsection: Document, Docs tab, Browse tab, Tag, External Link, Mini-Diagram. (§7 matrix already gates "Schema Documentation" correctly — left as-is.)
- [x] 1.3 Flagged the stale `apps/web/docs/{Baseout_PRD,Baseout_Features}.md` duplicates (they differ from `shared/` and are older) — noted here + in proposal Impact for a separate cleanup; NOT edited.
- [x] 1.4 `apps/design/specs/10-schema.md` — added Browse + Docs tabs as V1 (Tab 2 + Tab 3, renumbered Changelog→Tab 4 / Health→Tab 5); moved Documentation out of the V2/out-of-scope block; references `10a-schema-docs.md`.
- [x] 1.5 Author the Browse/Docs UI spec — **done at `apps/design/specs/10a-schema-docs.md`** (the `ui-only/overview/schema/05-docs-tab.md` path in `system-per-space-db/tasks.md` is in a separate repo and doesn't exist; authored in-repo with the other design specs). Browse tab (entity list + `EntityDetailHeader` detail panel + Documentation section) and Docs tab (list + Plate editor + tag picker + links + React Flow diagram); cites reused `ui/*`+`patterns/*` primitives.

## 2. Engine: per-Space document CRUD + read broker (TDD)

- [x] 2.1 Failing tests for the pure logic (`documents-logic.test.ts`, 9): `deriveExcerpt` (Plate-body flatten + truncate) and `flagRemovedTags`/`entityKey`. NOTE: the engine test pool hosts no Postgres (`baseout_test_unused`), so the Drizzle CRUD is smoke-only (same posture as `applySchemaDiff`) — DB-touching paths are covered by route-guard tests + manual smoke, not a Docker PG harness.
- [x] 2.2 `documents-logic.ts` (pure: `deriveExcerpt`/`flagRemovedTags`/`entityKey`) + `documents.ts` (I/O over `SpaceTx`): list/get/create (server-derived `excerpt`)/update/delete (cascade tags+links+diagrams in-txn), `addTag`/`removeTag`, `readDocsList`, `readDocsForEntity` (read-time `entityRemoved` via active-entity set). `readAllEntities` added to `space-db-pg.ts` for the Browse read.
- [x] 2.3 Routes `documents.ts`/`document.ts`/`docs-by-entity.ts` + `schema-read.ts` (Browse entity tree) — mirror the `schema-sync.ts` guards (UUID, `resolveSpaceDb`, `backend!=='managed_pg'`→501, `withSpaceSchema`). Opaque JSONB for body/state. Route-guard tests in `spaces-documents-route.test.ts` (14).
- [x] 2.4 Registered regexes + dispatch in `apps/server/src/index.ts`. No middleware change.
- [x] 2.5 Engine `tsc` clean; full suite 292 pass / 1 skip.

## 3. Web→engine client (TDD)

- [x] 3.1 Failing `backup-engine-documents.test.ts` (Fetcher stub, 9): path/method/headers, success shapes, `backend_not_implemented`/`document_not_found` mapping, `engine_unreachable`.
- [x] 3.2 `backup-engine.ts` — added `listDocuments`/`getDocument`/`createDocument`/`updateDocument`/`deleteDocument`/`docsByEntity` + `getSchema`, via a shared `schemaDocsRequest` helper reusing the binding+`x-internal-token`+discriminated-result plumbing.

## 4. Web proxy routes + SSR Docs/Browse slice — no React (TDD)

- [x] 4.1 Guard logic test-first in `lib/schema-docs/proxy.test.ts` (7: auth/IDOR/capability + error-status mapper) + `documents.test.ts` route handler tests (6: 503, method dispatch, validation, mapping).
- [x] 4.2 `apps/web/src/pages/api/spaces/[spaceId]/{documents.ts, documents/[docId].ts, docs-by-entity.ts, schema.ts}` — auth + IDOR + capability gate via the shared `guardSchemaDocsRequest`, then forward to the engine.
- [x] 4.3 `SchemaView.astro` — daisyUI `tabs`+`tab-content` (Browse + Docs); SSR Browse entity tree + detail panel (vanilla script → docs-by-entity, removed-entity warning). `schema.astro` fetches docs+schema server-side, gates on `level`, swaps in `SchemaView`. (Used `Card`+`DefinitionList` rather than the page-header-shaped `EntityDetailHeader`.)
- [x] 4.4 **Milestone:** full SSR slice — typecheck + build green. (Demoable; the Phase-4 textarea stand-in was superseded directly by the Phase-5 island.)

## 5. React islands: Plate + React Flow (TDD)

- [x] 5.1 Added `@astrojs/react`, `react`, `react-dom`, `platejs`, `@platejs/basic-nodes`, `@xyflow/react` (+ `@testing-library/react`, `jsdom`); `react()` in `astro.config.mjs` (adapter/output untouched). Verified via current Plate + React Flow docs (ctx7). Islands render client-only (mounted on user action, never SSR'd).
- [x] 5.2 `islands/DocBodyEditor.tsx` (Plate, `PlateContent` + basic-nodes hotkeys), `DocDiagram.tsx` (React Flow, serialize `{nodes,edges}` → `bo_at_document_diagrams.state`), `DocsTab.tsx` (self-contained authoring island: list + editor + tags + links + diagrams + CRUD), mounted `client:visible`. Pure logic extracted to `lib/schema-docs/editor-logic.ts` + tested (6) instead of jsdom-mounting Plate/RF. DEFERRED: inline `@`-tag Plate plugin — explicit tag picker ships now; inline-@ is a follow-up.
- [x] 5.3 Governance carve-out: `islands/README.md` + `islands-governance.test.ts` (no `.astro` under islands/). Documented in `10a-schema-docs.md` (not an SB_ENTRIES group — avoided the design-app type/render churn per §3.3). Islands stay `.tsx`.
- [x] 5.4 Scoped to `/schema` Docs tab via `client:visible` on a CSS-hidden panel; build green (Plate+RF chunk >500kB warning — deferred, doesn't load on other pages); `component-classification` green.

## 6. Cross-cutting: gating, AI "soon", flagged-removed UI (TDD)

- [x] 6.1 `tier-capabilities.ts` extended additively: `schemaDocs: 'none' | 'manual' | 'manual_ai'` (trial/starter→none, launch/growth→manual, pro+→manual_ai; Features §7 line 575) + test. Enforced in the proxy guard (403 `schema_docs_not_entitled`) + `schema.astro` SSR upsell `EmptyState` when `none`.
- [x] 6.2 AI generation: disabled "Generate with AI — Soon" control for `manual_ai` tiers in `DocsTab`; engine AI work deferred to a future `server-schema-ai-docs` change.
- [x] 6.3 Flagged-removed UI: Browse detail warning badge (vanilla) + editor tag chips warning (DocsTab); tags removable from the editor; never dropped (engine retains).

## 7. Verification

- [x] 7.1 Engine `tsc` clean + suite 292/1-skip; web `typecheck` 0 errors + `test:unit` 788 + `build` green.
- [ ] 7.2 Human smoke (engine `--remote`: deploy `apps/server` + `npx trigger.dev dev`; managed_pg Space). DB-touching CRUD + Plate/RF rendering need a provisioned per-Space DB — verify on a real Space.

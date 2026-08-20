# Slice A — Data SoonTab Un-gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Data-page `SoonTab` on `main` with the ui-only Data UI, wired to real engine reads (no fixtures), Storybook/daisyUI only.

**Architecture:** Promote ui-only Data components into `apps/web` via selective `git show ui-only/main:…` copies (never merge ui-only; never merge `web-ui-sync-promotion`). Add thin web proxies + `backup-engine` methods that call existing server routes. Map engine payloads → ui-only `dataTypes` in tested pure modules. Reuse live Schema Docs/Chat for the Docs/Chat tabs (do not promote the fork’s Schema re-arch). Comments need a **new** server read route (capture-only today).

**Tech Stack:** Astro SSR, Vitest, Cloudflare Workers service binding (`BACKUP_ENGINE` + `INTERNAL_TOKEN`), daisyUI / Storybook catalog, Drizzle (server comments read only).

**Spec / roadmap:**
- Program: `openspec/changes/web-cursor-ui-implementation/roadmap.md` (Phases 1–2)
- Existing (partially stale vs main): `openspec/changes/web-data-page/`, `openspec/changes/web-data-docs-chat/`
- Design tip: `ui-only/main` @ `9cf5b1ef`
- Branch: `autumn/cursor-ui-implementation-test`

## Global Constraints

- Storybook `ui/*` / `patterns/*` first, daisyUI second — **no custom components**
- No prod fixtures; no `console.*` / `debugger`
- Preserve DOM ids / `data-panel` keys where possible (`browse`, `changelog`, `comments`, `docs`, `chat`; add Attachments cluster per ui-only)
- `managed_pg` → honest LockedTab / empty when engine returns `501 backend_not_implemented`
- Do **not** merge `web-ui-sync-promotion` (read-only reference OK)
- Do **not** promote Schema re-arch (`SchemaBrowse`, fork `EntityPanel`, `QuickAskDock`) as part of Slice A
- Update `shared/internal/ui-sync.md` in the same commit as each promotion
- TDD for mappers, proxies, and the comments-read pure module

### Execution split

| Part | Tabs | Backend | OpenSpec |
|---|---|---|---|
| **A1** (Tasks 1–7) | Records · Attachments · Changelog | Exists on server | refresh `web-data-page` |
| **A2** (Tasks 8–11) | Comments · Docs · Chat | Comments read **new**; docs/chat exist | `server-comments-read` + `web-data-docs-chat` |

Ship A1 green before starting A2.

### Pin

```bash
PIN=9cf5b1ef   # or: git rev-parse ui-only/main
# Prefer: git show ui-only/main:<path>
```

### Main baseline (start state)

- `apps/web/src/views/DataView.astro` — five `SoonTab`s
- `apps/web/src/pages/data.astro` — shell only (`hasData` + `lastSyncedAt`)
- No `apps/web/src/components/data/`, no `/api/spaces/:id/data/*`
- Server already has: `data/tables/:tableId/records`, `data/changelog`, `media[…]`, `documents`, `chat-*`
- Server has comments **sync/plan only** — no list/read route

---

### Task 1: View types + pure mapper (TDD)

**Files:**
- Create: `apps/web/src/lib/data-browse/types.ts` (re-export or mirror ui-only `dataTypes` shapes used by SSR)
- Create: `apps/web/src/lib/data-browse/map.ts`
- Create: `apps/web/src/lib/data-browse/map.test.ts`
- Promote verbatim later: `apps/web/src/components/data/dataTypes.ts` from ui-only (Task 5); keep `lib/data-browse` as the **SSR mapping** layer so views stay presentational

**Interfaces:**
- Produces:
  - `mapSchemaToDataBasesTables(schema: GetSchemaResult): { bases: DataBase[]; tables: DataTable[] }`
  - `mapRecordsPage(enginePage): { records: DataRecord[]; nextCursor: string | null; total?: number; approximate?: boolean }`
  - `mapChangelog(engine): { changelog: DataChangeEntry[]; runTotals: Record<string, { created: number; updated: number; deleted: number }> }`
  - `mapMediaList(engine): MediaAsset[]`
- Consumes: `GetSchemaResult` from `backup-engine.ts`; engine JSON shapes from server handlers’ response bodies

- [ ] **Step 1: Write failing tests** for empty schema, one base/table/fields, records page with nextCursor, changelog rollup+rows, media asset list

```ts
import { describe, it, expect } from 'vitest'
import { mapSchemaToDataBasesTables, mapRecordsPage } from './map'

describe('mapSchemaToDataBasesTables', () => {
  it('returns empty arrays for empty schema', () => {
    expect(mapSchemaToDataBasesTables({ ok: true, bases: [], tables: [] } as never)).toEqual({
      bases: [],
      tables: [],
    })
  })
})
```

- [ ] **Step 2: Run** `pnpm --filter @baseout/web exec vitest run src/lib/data-browse/map.test.ts` — expect FAIL (module missing)

- [ ] **Step 3: Implement minimal `map.ts` + types** — map field metadata needed by Browse (id, name, type, link/formula provenance fields when present on schema)

- [ ] **Step 4: Re-run tests** — expect PASS

- [ ] **Step 5: Commit** `test(web): data-browse mappers (red-green)`

---

### Task 2: `backup-engine` Data + Media client methods

**Files:**
- Modify: `apps/web/src/lib/backup-engine.ts`
- Test: extend existing backup-engine tests if present; else `apps/web/src/lib/backup-engine.data.test.ts` with a fake `fetch`/binding

**Interfaces:**
- Produces (names must match proxies in Task 3):
  - `getDataRecords(spaceId, tableId, query: URLSearchParams | Record<string,string>): Promise<…>`
  - `getDataChangelog(spaceId, query): Promise<…>`
  - `getMedia(spaceId, query): Promise<…>`
  - `getMediaTotals(spaceId): Promise<…>`
  - `getMediaAsset(spaceId, assetId): Promise<…>`
  - `mediaDownload(spaceId, assetId): Promise<Response>` (stream passthrough)
- Engine paths:
  - `GET /api/internal/spaces/:spaceId/data/tables/:tableId/records`
  - `GET /api/internal/spaces/:spaceId/data/changelog`
  - `GET /api/internal/spaces/:spaceId/media`, `/media/totals`, `/media/:assetId`, `/media/:assetId/download`

- [ ] **Step 1: Write failing tests** asserting path + `x-internal-token` header on each method

- [ ] **Step 2: Run tests** — FAIL

- [ ] **Step 3: Implement methods** mirroring `listDocuments` / `getSchema` style in the same file

- [ ] **Step 4: Pass tests**

- [ ] **Step 5: Commit** `feat(web): backup-engine data + media read clients`

---

### Task 3: Web proxy routes (TDD) — records, changelog, media

**Files:**
- Create: `apps/web/src/pages/api/spaces/[spaceId]/data/tables/[tableId]/records.ts`
- Create: `apps/web/src/pages/api/spaces/[spaceId]/data/changelog.ts`
- Create: `apps/web/src/pages/api/spaces/[spaceId]/data/media/index.ts` (or `media.ts` + nested)
- Create: `apps/web/src/pages/api/spaces/[spaceId]/data/media/totals.ts`
- Create: `apps/web/src/pages/api/spaces/[spaceId]/data/media/[assetId].ts`
- Create: `apps/web/src/pages/api/spaces/[spaceId]/data/media/[assetId]/download.ts`
- Create: colocated `*.test.ts` per handler (pure `handleX` export pattern like `docs-by-entity.ts`)
- Reuse: `guardSchemaDocsRequest` from `apps/web/src/lib/schema-docs/proxy.ts` **or** introduce `guardDataBrowseRequest` that shares IDOR + Space membership; prefer **one shared guard** — if Features matrix has a Data-page tier, wire `tier-capabilities` here (Task 3b). If matrix entry missing, flag in PR; do not invent.

**Pattern (copy structure):**

```ts
// records.ts — sketch
export async function handleDataRecords(input: {
  account: AccountContext | null
  spaceId: string | undefined
  tableId: string | undefined
  searchParams: URLSearchParams
  fetchSpace: …
  resolveLevel: …
  engine: ((spaceId, tableId, sp) => Promise<…>) | null
}): Promise<Response> {
  const guard = await guardSchemaDocsRequest({ … }) // or data-specific guard
  if (!guard.ok) return guard.response
  if (!input.tableId) return jsonResponse({ error: 'invalid_request' }, 400)
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)
  const r = await input.engine(guard.space.id, input.tableId, input.searchParams)
  // map 501 backend_not_implemented → JSON error the UI LockedTab understands
  …
}
```

- [ ] **Step 1: Failing route tests** — 401/403 IDOR, 400 missing tableId, 200 passthrough shape, 501 passthrough

- [ ] **Step 2: Run** — FAIL

- [ ] **Step 3: Implement handlers**

- [ ] **Step 4: Pass**

- [ ] **Step 5: Commit** `feat(web): data browse proxy routes (records/changelog/media)`

---

### Task 4: Promote Data UI closure from ui-only (A1 components)

**Files (promote with `git show ui-only/main:<path>` → target):**

| ui-only path | lands at |
|---|---|
| `apps/web/src/components/data/dataTypes.ts` | same |
| `apps/web/src/components/data/DataBrowse.astro` | same |
| `apps/web/src/components/data/DataChangelog.astro` | same |
| `apps/web/src/components/data/DataMedia.astro` | same |
| `apps/web/src/components/data/MediaPanel.astro` | same |
| `apps/web/src/components/data/MediaThumb.astro` | same |
| `apps/web/src/components/data/RecordPanel.astro` | same |
| `apps/web/src/components/data/LockedTab.astro` | same |
| `apps/web/src/components/data/StaticImport.astro` | same |
| helpers `recordReadBody.ts`, `runReadBody.ts`, `mediaFormat.ts`, `mediaReadBody.ts` | same |

**Also promote dependency closure only as needed** (stop if Schema re-arch):

| Likely dep | Rule |
|---|---|
| `components/ui/PanelHost.astro` + `panel*.ts`, `splitView.ts`, `tooltip.ts`, `viewState.ts`, `DateRangePicker.astro` | Promote + **story + classification** |
| `components/schema/FacetFilter.astro`, `locationCrumbs`, `workspaceGroups` | Promote if imported |
| `lib/listSheet.ts`, `mobileNav.ts`, `refineCollapse.ts`, `refineFacetIcons.ts` | Promote if imported |
| `ExportControl` | **Rewrite imports** to `apps/web` `patterns/ExportControl.astro`; drop fork-only props (`formats` / `splitScope` / `changeScope` if absent) |
| Fork `SchemaDocs` / `SchemaChat` / `EntityPanel` / `QuickAskDock` | **Do not promote** in A1 |

**Reconciles (standing):**
- `ParentNode` → `HTMLElement` / `Document | HTMLElement`
- Variadic `append(...)` → `appendChild` loops under worker DOM types
- Scoped `<style>` → `<style is:global>` when classification bans scoped style in `components/**`
- No fixture imports left in promoted files

- [ ] **Step 1: List import graph** from `DataBrowse` / `DataChangelog` / `DataMedia` / `RecordPanel` at `$PIN`; write the closure list into the PR notes

- [ ] **Step 2: Copy files**; apply only permitted reconciles

- [ ] **Step 3: Register** every new `components/ui/*` and `components/data/*` in:
  - `component-classification.json`
  - `*.stories.ts` (extend existing patterns)
  - `raw-markup-audit-allowlist.json` for views if needed

- [ ] **Step 4: Run** `pnpm --filter @baseout/web audit:components` — must exit 0

- [ ] **Step 5: Commit** `feat(web): promote ui-only Data browse/media/changelog components @$PIN`

---

### Task 5: Wire `DataView` + `data.astro` (A1 tabs live)

**Files:**
- Modify: `apps/web/src/views/DataView.astro` — match ui-only tab clusters (Records · Attachments · Comments | Changelog | Docs · Chat); **A1:** real panels for Records/Attachments/Changelog; Comments/Docs/Chat stay `SoonTab` or LockedTab until A2
- Modify: `apps/web/src/pages/data.astro` — SSR load schema → bases/tables; page-1 records for landing table; changelog page-1; media page-1 + totals; detect `mode` (dynamic vs static) from Space backup config if available, else default `dynamic` with honest degrade on 501
- Update: `shared/internal/ui-sync.md` §4 Data row for Browse/Changelog/Attachments

**Props contract (minimum for A1):**

```ts
interface Props {
  bases: DataBase[]
  tables: DataTable[]
  records?: DataRecord[]
  changelog?: DataChangeEntry[]
  assets?: MediaAsset[]
  runTotals?: Record<string, { created: number; updated: number; deleted: number }>
  mode?: DataMode
  lastSyncedAt?: string | null
  lastSyncedRunId?: string | null
  landingTableId?: string
  loadState?: 'ready' | 'loading' | 'error'
  managedPg?: boolean // drives LockedTab vs panels
}
```

- [ ] **Step 1: Replace** Browse / Changelog / Attachments `SoonTab`s with `DataBrowse` / `DataChangelog` / `DataMedia` (+ `RecordPanel`/`MediaPanel` mounts as in ui-only, without EntityPanel/QuickAskDock)

- [ ] **Step 2: SSR in `data.astro`** — `createBackupEngine` + mappers; on engine 501 set `managedPg=false` and show LockedTab copy from ui-only StaticImport/LockedTab paths

- [ ] **Step 3: Client fetch** — Browse “Load more” / filter changes hit `/api/spaces/:spaceId/data/...` (not fixtures). Confirm `setButtonLoading` on any button that waits on network

- [ ] **Step 4: Manual smoke** on a managed_pg Space with backups (human): open `/data`, switch tables, load more, open record panel, changelog filters, attachments list/download

- [ ] **Step 5: Commit** `feat(web): wire Data Browse/Changelog/Attachments to real engine`

---

### Task 6: A1 verification gate

- [ ] **Step 1:** `pnpm --filter @baseout/web test:unit` (targeted data-browse + proxies)
- [ ] **Step 2:** `pnpm --filter @baseout/web typecheck` + `build`
- [ ] **Step 3:** `pnpm --filter @baseout/web audit:components`
- [ ] **Step 4:** Grep diff for `console\.` / `debugger` / fixture imports
- [ ] **Step 5:** Mobile pass notes at &lt;375 / &lt;768 / &lt;1024
- [ ] **Step 6: Commit** ledger-only if needed: `docs(ui-sync): Data A1 Browse/Changelog/Media REAL`

**Stop here for review before A2.**

---

### Task 7: File / refresh OpenSpec for A2 server half

**Files:**
- Create: `openspec/changes/server-comments-read/{proposal,design,tasks}.md` (if missing on branch)
- Mirror shape of `server-data-browse` read routes: pure query module + IO + route + tests

**Contract to lock in design.md:**

```
GET /api/internal/spaces/:spaceId/data/comments
Query: cursor, limit, baseId?, tableId?, recordId?, author?
Response: { ok, comments: [...], nextCursor }
501 backend_not_implemented when not managed_pg
```

Read from `bo_at_comments` (already written by `comments-sync`).

- [ ] **Step 1: Write proposal/design/tasks**
- [ ] **Step 2: Commit** `docs(openspec): server-comments-read for Data Comments tab`

---

### Task 8: Implement `server-comments-read` (TDD)

**Files:**
- Create: `apps/server/src/lib/per-space/comments-read.ts` (pure filter/order/keyset)
- Create: `apps/server/src/lib/per-space/comments-read-io.ts`
- Create: `apps/server/src/pages/api/internal/spaces/data-comments.ts` (or `comments-read.ts`)
- Modify: `apps/server/src/index.ts` — register `GET …/data/comments`
- Create: Vitest tests under `apps/server` matching sibling data-records tests

- [ ] **Step 1: Failing tests** for filter + keyset + soft-deleted exclusion
- [ ] **Step 2: Implement pure + IO + route**
- [ ] **Step 3:** `pnpm --filter @baseout/server test` (targeted)
- [ ] **Step 4: Commit** `feat(server): GET data/comments read path`

---

### Task 9: Web Comments tab

**Files:**
- Promote: `DataComments.astro`, `commentText.ts`
- Extend: `backup-engine` + proxy `pages/api/spaces/[spaceId]/data/comments.ts`
- Extend: `map.ts` + `mapComments` tests
- Modify: `DataView.astro` — replace Comments `SoonTab`
- Modify: `data.astro` — SSR page-1 comments

- [ ] **Steps:** same TDD → promote → wire → `audit:components` → commit `feat(web): Data Comments tab on real comments read`

---

### Task 10: Docs + Chat un-gate (`web-data-docs-chat`)

**Correction vs existing proposal:** on this branch Browse is **not** already live until A1 ships. Run this task **only after Task 6**.

**Files:**
- Promote: `components/data/dataToSchema.ts` + tests
- Modify: `views/schema/DocsTab.astro`, `ChatTab.astro` — additive `scope?: 'schema' | 'data'` (default `'schema'`); Schema call sites unchanged
- Modify: `DataView.astro` — mount DocsTab/ChatTab (or LockedTab for static); **do not** mount fork SchemaDocs/SchemaChat/QuickAskDock
- Modify: `data.astro` — SSR `listDocuments` + `listChatThreads` (methods already exist)

- [ ] **Step 1: dataToSchema tests** (TDD)
- [ ] **Step 2: Scope props** — Schema regression: Docs/Chat markup unchanged at default scope
- [ ] **Step 3: Replace Docs/Chat SoonTabs**
- [ ] **Step 4: Smoke** Docs create/tag; Chat thread + reply (Pro+); static LockedTab; non-Pro chat gate
- [ ] **Step 5: Commit** `feat(web): Data Docs + Chat tabs reuse Schema surfaces`

---

### Task 11: Slice A close-out

- [ ] **Step 1:** Confirm **zero** `SoonTab` remain inside `DataView.astro` (Schema Automations/Interfaces Still SoonTabs — out of Slice A)
- [ ] **Step 2:** Update `openspec/changes/web-data-page/tasks.md` + `web-data-docs-chat/tasks.md` checkboxes
- [ ] **Step 3:** Update `shared/internal/ui-sync.md` §4 Data row: all six tabs REAL (or Comments attachments/reactions noted as follow-up)
- [ ] **Step 4:** Update roadmap Phase 1–2 status to done
- [ ] **Step 5: Final** typecheck + build + audit:components + targeted tests

---

## Out of scope (Slice A)

- Schema Automations/Interfaces (Phase 9)
- Reports (Phase 8)
- Settings hub / Auth visual / Inbox (Phases 4–6)
- Full Schema component re-architecture
- Comment attachments/reactions if not in `bo_at_comments` payload
- QuickAskDock global launcher
- Merging `web-ui-sync-promotion`

## Risk notes

1. **Import closure explosion** — stop and surface if DataBrowse pulls Schema re-arch. Prefer stubbing panel openers to RecordPanel-only.
2. **PanelHost missing on main** — promote with stories; don’t hand-roll.
3. **ExportControl API drift** — always adapt to apps/web patterns API.
4. **V1 Data tier** — reconcile Features §5.5/§7; flag conflicts.
5. **web-data-docs-chat proposal line numbers** — stale; follow this plan’s task order.

---

## Self-review

| Requirement | Task |
|---|---|
| Browse real data | 1–5 |
| Changelog real | 1–5 |
| Attachments/Media real | 1–5 |
| Comments real | 7–9 |
| Docs/Chat real | 10 |
| No custom components / audit green | 4, 6, 11 |
| Ledger update | 5, 9, 10, 11 |
| No promotion-branch merge | Global |

---

**Plan complete.** Saved to `docs/superpowers/plans/2026-08-20-slice-a-data-soon-tabs.md`.

**Two execution options when you want to build:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, executing-plans with checkpoints  

Which approach (and confirm: start at **Task 1 / Part A1**)?

# Phase 13 — Schema re-architecture

> **For agentic workers:** promote ui-only Schema components into `apps/web` in slices; keep real engine wiring at every step. REQUIRED: `/ui-sync` discipline (never merge ui-only; never merge `web-ui-sync-promotion`).

**Goal:** Replace the live round-3 Schema shell + `views/schema/*Tab` bodies with the fork’s re-architected ~24-component set, wired to REAL data — preserving Browse, Visualize, Relationships, Health, Docs, Chat, Changelog, Automations, and Interfaces behavior.

**Branch:** `autumn/cursor-ui-implementation-test`  
**Pin:** `ui-only/main` @ `4073f919` (EntityPanel read-only Airtable = `7502f810`)  
**OpenSpec:** [`openspec/changes/web-schema-rearch/`](../../openspec/changes/web-schema-rearch/)  
**Ledger:** `shared/internal/ui-sync.md` §4 Schema re-arch (deferral CLEARED 2026-08-20)

## Inventory delta (fork tip vs live `apps/web`)

### Fork-only (promote)

| Path | Role |
|---|---|
| `SchemaBrowse.astro` | Browse tree (replaces `BrowseTab`) |
| `SchemaCanvas.tsx` | Visualize island (live already has `islands/SchemaCanvas`) |
| `SchemaRelationships.astro` + `schemaRelationships.ts` + `RelationshipPanel.astro` + `relStatusBadge.ts` | Relationships |
| `SchemaHealth.astro` | Health |
| `SchemaChangelog.astro` + `changelogTypes.ts` | Changelog |
| `SchemaDocs.astro` | Docs |
| `SchemaChat.astro` + `schemaChat.ts` | Chat (live has `ChatTab` — integrate, don’t regress) |
| `SchemaAutomations.astro` / `SchemaInterfaces.astro` (fork shapes) | A&I listing (live Phase 9 CRUD proxies — **integrate**, don’t replace blindly) |
| `EntityPanel.astro` + `entityPanelController.ts` + `schemaReadBody.ts` + `entityChip.ts` + `automationAnatomy.ts` | Shared stacking drawer |
| `QuickAskDock.astro` | Global ask launcher (shell) |
| `ExportControl.astro` (schema-local) / `FieldsFilter.tsx` / `schemaTableHead.ts` | Shared chrome |
| `schemaEntities.ts` tip (no `airtableDraft`) | Entity index — supersede draft lifecycle |

### Live today (keep until replaced per slice)

- `SchemaView.astro` — round-3 cluster shell + `*Tab.astro` modules
- `BrowseTab` inline `#entity-detail` panel (`buildEntityPanelIndex` + docs-by-entity)
- `EntityPanel.astro` — **Phase 8 Reports stub** (`schema:openEntity` → soon modal)
- Phase 9 `SchemaAutomations` / `SchemaInterfaces` + tabs over manual-CRUD proxies
- Engine SSR: `schema.astro` → `getSchema` + `listDocuments`; relationships/health/changelog/chat proxies

### Design harness

Most fork Schema components already exist under `apps/design/src/components/schema/` (Stage-1 sync). **Prefer `ui-only/main` tip** over design copies — design `EntityPanel` still carries the interim Publish lifecycle that `7502f810` removed.

## Constraints

- Storybook / daisyUI only; allowlist + classification + stories; `audit:components` green
- No fixtures; no `console.*`
- Airtable descriptions: **read-only** (promote `7502f810` lineage)
- Internal notes: display `descriptionOverride`; **Save write API does not exist yet** (web-schema-round3-shell deferred) — honest-gate edit until `server-entity-annotations` (or equivalent)
- Documentation section: wire via real `docs-by-entity` / `listDocuments`
- Automations/Interfaces: preserve Phase 9 CRUD; EntityPanel reverse-refs may start empty and fill as types align
- Do **not** merge `web-ui-sync-promotion`

## Slices

| Slice | Deliverable | Status |
|---|---|---|
| **0** | Inventory + plan + openspec + ledger/roadmap IN PROGRESS | **DONE** |
| **1** | EntityPanel promote + mapper + mount on Schema (+ Reports stub replacement); docs-by-entity; Internal Save honest-gated | **DONE** (`8bc16054`) |
| **2** | Shell/nav → fork SchemaView chrome + PanelHost; keep tab modules mounted | **DONE** |
| **3** | Browse → `SchemaBrowse` + drop inline `#entity-detail` | **DONE** |
| **4** | Remaining tabs (Visualize/Relationships/Health/Changelog/Docs/Chat) one-by-one | **DONE** — Visualize/Relationships/Health/Changelog tip+mappers; Docs/Chat **kept live** (Plate + chat poll) |
| **5** | A&I integration into new shell (no CRUD regression); QuickAskDock | **DONE** — QuickAskDock mounted; A&I already in shell (Phase 9 CRUD preserved) |
| **6** | Allowlist/stories polish; roadmap DONE; archive readiness | **DONE** for code path — roadmap/ledger updated; archive when human smoke + `opsx:archive` |

## Slice 1 detail

**Promote (verbatim from tip, path rewrites only):**
- `EntityPanel.astro`, `entityPanelController.ts`, `schemaReadBody.ts`, `entityChip.ts`, `automationAnatomy.ts`
- Type carriers: `SchemaAutomation` / `SchemaInterface` / `ChatThread` exports (add to live files or thin type modules — do not replace Phase 9 tab bodies)

**New:**
- `lib/schema-docs/map-entity-index.ts` (+tests) — engine `SchemaEntity*` → nested canvas tables → `buildEntityIndex` → `SchemaEntity[]` with `airtableDescription` ← `description`, `userDescription` ← `descriptionOverride`
- Map `SchemaDocSummary[]` → panel `SchemaDoc[]` (id/title; entityIds filled via docs-by-entity on open where needed)

**Wire:**
- `SchemaView`: mount `PanelHost` + `EntityPanel` with SSR index/docs
- Browse / Visualize / Relationships: prefer `schema:openEntity` over stub modal / keep Browse card as fallback until Slice 3
- Reports views: real panel replaces stub (same props surface)

**Honest gates:**
- Internal note Save → no engine write yet (announce / disable persist)
- AI Generate → existing capability gate
- No Publish / Discard-to-Airtable (removed upstream)

## Verification (per slice)

- Demo: `/schema` → Browse row → EntityPanel opens; Airtable tab read-only; Documentation lists real docs-by-entity; Internal shows `descriptionOverride`
- Test: mapper unit tests; `pnpm --filter @baseout/web audit:components`
- Checks: targeted unit + typecheck
- Caveats: annotations write API still missing; full tab swap is later slices

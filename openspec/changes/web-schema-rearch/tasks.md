# web-schema-rearch tasks

## 0. Plan + ledger

- [x] 0.1 Inventory fork vs live; file plan under `docs/superpowers/plans/`
- [x] 0.2 OpenSpec change folder `web-schema-rearch`
- [x] 0.3 Mark Phase 13 IN PROGRESS in roadmap + clear deferral in `ui-sync.md` §4

## 1. EntityPanel slice (first promote)

- [x] 1.1 Promote `EntityPanel.astro` + `entityPanelController.ts` + `schemaReadBody.ts` + `entityChip.ts` + `automationAnatomy.ts` from `ui-only/main` tip
- [x] 1.2 Type exports for `SchemaAutomation` / `SchemaInterface` / `ChatThread` without replacing Phase 9 tab bodies
- [x] 1.3 Mapper engine schema → `SchemaEntity[]` (+ vitest); map docs summaries for panel titles
- [x] 1.4 Mount `PanelHost` + `EntityPanel` on `SchemaView`; bridge `schema:openEntity`
- [x] 1.5 Documentation section: real `docs-by-entity` (or SSR docs with entityIds)
- [x] 1.6 Internal note Save: honest-gate (no write API yet); Airtable tab read-only
- [x] 1.7 Replace Reports EntityPanel stub; update classification + stories
- [x] 1.8 `audit:components` green; targeted tests

## 2. Shell + Browse

- [x] 2.1 Promote fork SchemaView chrome / nav; keep working tabs mounted
- [x] 2.2 Promote `SchemaBrowse`; retire Browse inline `#entity-detail`

## 3. Remaining tabs

- [ ] 3.1 Visualize / Relationships / Health / Changelog / Docs / Chat — one tab per sub-slice, preserve proxies
  - [x] Visualize: tip workspace-grouping into live SchemaCanvas; atBases join; keep spaceId relationships fetch + adaptEngineRelationships
  - [x] Relationships: tip SchemaRelationships + RelationshipPanel; SSR engine map; Confirm/Dismiss/Declare → relationship-mutate
  - [ ] Health → Changelog → Docs → Chat
- [ ] 3.2 A&I: integrate Phase 9 CRUD into new shell (no regression)
- [ ] 3.3 QuickAskDock (global launcher)

## 4. Close

- [ ] 4.1 Ledger §4 rows + roadmap Phase 13 DONE
- [ ] 4.2 Human smoke on managed_pg Space

# server-mcp-interface-pages — build notes + 4.2 smoke recipe

Built 2026-07-14 (see [tasks.md](tasks.md) for per-task outcomes). Paired change:
[`workflows-mcp-interface-pages`](../workflows-mcp-interface-pages/) — land this one first
(it did: engine accepts + persists the optional field; nothing sends it yet).

## What shipped

- `apps/server/src/lib/per-space/interfaces-sync.ts` — pure contract + extraction + diff
  (`InterfacePagesCapture`, `parseInterfacePagesField`, `extractInterfaceEntities`,
  `diffInterfaces`). This file is the payload-shape source for the workflows change.
- `apps/server/src/lib/per-space/space-db-pg.ts` — `readInterfaceWorkingSet` (MCP rows only)
  + `applyInterfaceDiff` (insert / seen-refresh / removed / `bo_at_schema_updates` writes).
- `apps/server/src/pages/api/internal/spaces/schema-sync.ts` — optional `interfacePages`
  field; interface processing rides the same `withSpaceSchema` transaction + base-run
  association as the schema diff; response gains an `interfaceSync` summary when the field
  is present.
- `apps/server/src/lib/capabilities/interface-backup.ts` + `interfacesEnabled` on
  `BackupBaseTaskPayload` (resolved once per run in `processRunStart`; wired in
  `start-deps.ts`, shared by the route and the SpaceDO scheduler).

## 4.2 smoke (deployed dev engine) — automated

```bash
pnpm --filter @baseout/server deploy:dev     # once, after code changes
node openspec/changes/server-mcp-interface-pages/smoke.mjs   # [spaceId] optional arg
```

[smoke.mjs](smoke.mjs) plays the workflows task's role end-to-end: first capture →
mutated capture → absent field → identical capture → page removal → manual-row isolation,
asserting the engine response AND the per-Space DB rows at each step (14 checks), then
cleans up after itself. **PASS on 2026-07-14.** The manual curl equivalent follows for
reference.

**Safety:** use a FICTIONAL `baseId` (e.g. `appZZitfSmokeTest1`) — schema-sync runs the
real schema diff with `confident=true`, so POSTing a thin `captured` for a REAL base id
would mark that base's actual tables/fields removed in the per-Space DB.

```bash
# 1. Deploy the engine, then POST a first capture (token from apps/server/.dev.vars):
curl -sS -X POST "https://baseout-server-dev.openside.workers.dev/api/internal/spaces/<SPACE_ID>/schema-sync" \
  -H "x-internal-token: $INTERNAL_TOKEN" -H "content-type: application/json" -d '{
  "backupRunId": "<ANY-UUID>",
  "captured": { "baseId": "appZZitfSmokeTest1", "name": "Smoke", "tables": [] },
  "interfacePages": {
    "capturedAt": "2026-07-14T10:00:00.000Z",
    "raw": { "interfaces": [ { "id": "pbdSmoke1", "name": "Interface", "pages": [ {
      "id": "pagSmoke1", "interfaceId": "pbdSmoke1", "name": "Page A", "pageType": "list",
      "sourceTableId": "tblSmoke1", "tablesByTableId": { "tblSmoke1": { "id": "tblSmoke1",
      "name": "T", "fields": [ { "id": "fldA", "name": "Status", "isEditable": false } ] } }
    } ] } ], "standaloneForms": [] }
  }
}'
# expect: 200 with "interfaceSync": { "ok": true, "added": 2, "removed": 0, "updates": 0, "unchanged": false }
```

2. POST again with `"name": "Page A v2"` on the page and one extra field id in
   `tablesByTableId` → expect `interfaceSync.updates: 2` (one `name`, one `config`), and in
   the per-Space DB (`bo_space_<id>` schema): 3 `bo_at_interfaces` rows (`submitted_via='mcp'`),
   the page row renamed, plus 2 `bo_at_schema_updates` rows with `entity_type='interface'`.
3. POST a third time WITHOUT `interfacePages` → response has no `interfaceSync`; rows and
   updates unchanged (absent ≠ deleted).
4. POST the step-2 body again unchanged → `interfaceSync.unchanged: true`, `last_seen_at`
   bumped, no new update rows.
5. Manual-row assertion (2.4): insert a row for `pagSmoke1` with `submitted_via='manual'`
   by hand, re-run step 4, confirm the manual row is byte-identical after.
6. Cleanup: delete the smoke rows (`bo_at_interfaces`, `bo_at_schema_updates`,
   `bo_at_bases`/`bo_at_base_runs`/`bo_at_schema_versions` for `appZZitfSmokeTest1`).

## Follow-ups filed elsewhere

- Interface added/removed events in the changelog FEED + `ChangelogEntityType` widening →
  `server-schema-changelog` §4 (dependency note added there 2026-07-14; lifecycle is
  timestamp-based — no run columns on `bo_at_interfaces`).
- Dedupe-by-`airtable_entity_id` when the FIRST reader of `bo_at_interfaces` is built
  (no read path exists anywhere today) → `web-automations-interfaces-tabs` /
  `web-interfaces-source-badge`.
- Unique `(base_id, airtable_entity_id)` partial index → ships with
  `server-automations-interfaces-manual-crud`; writes here are row-id-targeted until then.

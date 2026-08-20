# web-schema-rearch — promote fork Schema component set

## Why

Product owner cleared the 2026-08-14 Schema re-architecture deferral on
2026-08-20 (Phase 13 on `autumn/cursor-ui-implementation-test`). The ui-only
fork re-architected Schema into ~24 dedicated components (`SchemaBrowse`,
`EntityPanel`, `RelationshipPanel`, `SchemaCanvas`, …). Live `apps/web` still
runs the round-3 shell + `views/schema/*Tab` modules. EntityPanel on web is a
Phase 8 Reports stub. Automations/Interfaces already LIVE on proxies (Phase 9)
must not regress.

## What Changes

- Promote the fork Schema component cluster into `apps/web` in slices (shell →
  Browse → EntityPanel → remaining tabs → A&I integration).
- Wire every slice to REAL engine / proxy data (`getSchema`, docs, relationships,
  health, changelog, chat, A&I). No fixtures.
- EntityPanel: promote `ui-only@7502f810` read-only Airtable descriptions; wire
  Documentation via docs APIs; no faked Publish.
- Update `shared/internal/ui-sync.md` §4 and the Phase 13 roadmap row as slices land.

## Out of scope

- Merging `web-ui-sync-promotion` or `git merge ui-only`
- Inventing an Airtable write-back path (explicitly removed upstream)
- Full annotations **write** route for `description_override` (honest-gate until
  a paired `server-*` change exists — display of overrides is in scope)

## Plan

[`docs/superpowers/plans/2026-08-20-phase-13-schema-rearch.md`](../../../docs/superpowers/plans/2026-08-20-phase-13-schema-rearch.md)

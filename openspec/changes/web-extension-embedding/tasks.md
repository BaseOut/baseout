# Tasks — Airtable extension embedding (unified wrapper + schema-viz quick win)

## Design-stage (with Dan)
- [ ] Pin the messaging contract v1 with Dan: message types, surface identifier
      (`data-extension` | `interface-extension`), context payload
      (`baseId/tableId/viewId`), auth handshake — document it in `design.md` here
- [ ] Decide the wrapper packaging/shipping vehicle (Airtable extension project layout,
      review/publish path) — Dan is prototyping; align before building
- [ ] Resolve: does install-time schema visualization for an *unconfigured* base need a
      new engine pull path? If yes, file the paired `server-*` change and cross-reference

## Implementation (after contract pinned)
- [ ] Embedded-context detection + compact layout per the parent `web` spec
      (`openspec/changes/web/specs/airtable-extension-embedding/spec.md`)
- [ ] Shared wrapper module (single codebase, both extension surfaces) + typed
      postMessage handler in apps/web
- [ ] Context deep-link: wrapper-reported base opens the Schema page scoped to it
- [ ] Install-time quick win: first embedded load renders the detected base's schema
      visualization (reuse `SchemaView` / the Schema Docs surface)
- [ ] First-use auth popup flow (per parent spec) verified inside a real Airtable iframe
- [ ] Tests first for the message handler + context reducer (Vitest); E2E smoke inside
      Airtable noted as manual with steps in the commit's Verification block

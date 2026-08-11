# Airtable extension embedding — unified wrapper + schema-viz quick win

## Why
Airtable Extension Embedding is a V1 Must-Have (Baseout_PRD.md §6.7, §9 line 722,
§10 line 782): Baseout runs inside Airtable via an iframe wrapper with a
`window.postMessage` framework. The base requirements live in the parent `web`
change (`openspec/changes/web/specs/airtable-extension-embedding/spec.md`).

At the Jul 6, 2026 Dan/Autumn sync, Dan detailed the wrapper design further:

1. **Unified wrapper code** — one wrapper handles both Airtable *data extensions* and
   *interface extensions*, rather than two divergent shells.
2. **Context awareness** — the wrapper's messaging protocol reports which base the
   user is currently viewing, so the embedded app deep-links straight to that base.
3. **Quick win: auto schema visualization** — immediately upon installation, the
   system visualizes the schema of the detected base, giving value before any backup
   is configured. This reuses the shipped Schema Docs surface
   (`apps/web/src/pages/schema.astro` / `SchemaView`).

This change captures those decisions as spec deltas so the wrapper work is anchored
in openspec before implementation starts.

**Status: design-stage.** Dan is still shaping the wrapper; expect this proposal to be
revised as the messaging contract and the Airtable-side packaging firm up. Filed now so
the meeting decisions aren't lost and follow-up work has a home.

## What changes
- **Modify** the postMessage-framework requirement: the wrapper is a single shared
  module deployed into both extension surfaces; the context message identifies the
  hosting surface (`data-extension` | `interface-extension`) alongside
  `baseId/tableId/viewId`.
- **Add** an install-time quick-win requirement: on first embedded load with a
  detected base, the app renders that base's schema visualization (read-only pull —
  no backup configuration required first). Pre-registration schema visualization is
  already V1 scope (PRD §10), this pins it to the embedded install moment.
- **Add** deep-linking on context: when the wrapper reports a base the user's Space
  already tracks, the embedded app opens the Schema page scoped to that base.

## Non-goals
- No general UI-building tooling inside the extension — the persona is the platform
  admin (Jul 6 decision); the embedded app assists with data management and backups.
- No Airtable writeback (V2, PRD §10).
- No changes to the standalone (non-embedded) app layout.

## Impact
- `apps/web` — embedded-context detection + layout (from the parent `web` change),
  the wrapper module, message-contract types, install-time schema-viz route wiring.
- `apps/server` — read-only schema pull for an unconfigured base may need an engine
  path; if so it files as a paired `server-*` change (cross-referenced here) rather
  than widening this one.
- Airtable-side extension packaging (the thin wrapper submitted to Airtable) —
  tracked here at the contract level; the shipping vehicle is decided with Dan.

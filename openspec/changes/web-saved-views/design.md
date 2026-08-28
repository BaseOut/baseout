# Design — web-saved-views

## D1 — Serializer extraction is a pure move

`preset-serialize.ts` exports the Serialized* types + `serializeNode/deserializeNode/
serializeConfig/deserializeConfig/treeEq/setEq/configEq` against minimal structural
interfaces (`{ id }`-shaped fields, `{ fields }`-shaped tables) so it stays free of the
inline script's DOM types. The inline script imports it (Astro bundles module scripts);
behavior byte-identical — staleness guards, `'\0'` joins (X-CENSUS-INSTRUMENT-NUL-BYTE:
escape stays the escape), 'all' commentFilter default all preserved and now vitest'd.

## D2 — Server is the SAVED layer; localStorage remains the DRAFT layer

The page SSR-loads saved presets (DataBody's existing engine block gains `listSavedViews`)
and embeds them in the DataBrowse snapshot as full `SerializedPreset`s (`saved: true`,
`baseline` = row config — the server row IS the baseline, server-saved-views D4). The
PERSISTENCE BLOCK rehydrates them first, then overlays localStorage: `edits[id]` (dirty
config on top of a saved baseline — the existing fixture-edits mechanism, generalized to
server ids) and `drafts` (never-saved presets), plus openIds/activeId. A draft whose id
became server-known is dropped from the local layer. The lossy fixture `SavedViewJSON`
path stays untouched for the design harness; production DataView passes no fixture views.

## D3 — Diff-sync from persistState(), not per-action wiring

persistState() already recomputes full state after every mutation (called from
renderViews()). A `syncSavedViews()` step diffs the current saved set against a
`serverKnown` map (id → last-synced row JSON) and fires create/patch/delete calls
fire-and-forget (microtask-debounced). One sync site covers Save, rename, pin, reorder,
revert, and delete without touching each handler. On create, the local `v-new-*` id is
remapped to the server uuid in place (views/openIds/activeId — the next render repaints
DOM ids anyway). Failures degrade silently to the localStorage layer — same resilience
posture the block has always had ("never throws").

## D4 — Proxy routes clone the documents proxy

`/api/spaces/:spaceId/views[/:viewId]` — same `guardSchemaDocsRequest` gate the Data
proxies use (records/media/comments), same testable-inner-handler shape, forwarding to the
new engine brokers. `createdByUserId` threads from the session user on create.

## D5 — Deliberately not here

View groups (fixture-only concept, no production data), multi-device conflict resolution
(last-write-wins), and offline queueing. Page size stays a local user preference.

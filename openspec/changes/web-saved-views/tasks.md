# Tasks — web-saved-views

TDD throughout (§3.4).

- [x] 1.1 Extract `src/lib/data-browse/preset-serialize.ts` (D1) + vitest (round-trip,
      staleness drops, commentFilter default, configEq matrix); DataBrowse imports it —
      no behavior change (existing Data page smoke unaffected).
- [x] 1.2 Engine client: `listSavedViews/createSavedView/updateSavedView/deleteSavedView`
      in `lib/backup-engine` (documents-methods shape).
- [x] 1.3 Proxy routes `/api/spaces/:spaceId/views[/:viewId]` (D4) + route tests
      (documents proxy test shape).
- [x] 1.4 SSR load: DataBody fetches saved views, DataView → DataBrowse `savedPresets`
      prop, snapshot embed; PERSISTENCE BLOCK rehydrates server presets first (D2).
- [x] 1.5 `syncSavedViews()` diff-sync in persistState() (D3) incl. create-id remap;
      localStorage narrowed to the draft layer.
- [x] 1.6 Gates: web vitest green (preset-serialize 8, views proxy 8, data-browse suite,
      tokens 20); `astro check` delta-clean (84 pre-existing errors before AND after —
      middleware/DataBrowse-root-null etc., none in touched code); full web BUILD green.
      **Manual smoke still owed (human)**: Save → reload → preset persists; MCP-created
      view appears in the Data page after reload; offline mirror fallback. Added beyond
      the plan: `dg-saved-mirror` localStorage fallback + sync disabled when the SSR
      fetch fails (never delete/create against a server we couldn't read), and the
      first sync auto-MIGRATES pre-existing localStorage-saved presets to the server
      (create + id remap).

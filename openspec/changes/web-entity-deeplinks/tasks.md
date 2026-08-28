# Tasks — web-entity-deeplinks

- [x] 1.1 Shared deferred-dispatch helper (the DataComments after-`load` pattern, extracted
      once instead of copied twice) + `?entity=` wiring on /schema (tests on the pure
      param→event mapping).
- [x] 1.2 `?record=<id>&table=<t>` wiring on /data (same helper).
- [x] 1.3 Engine client `dataSearch` + `/api/spaces/:spaceId/data/search` proxy route +
      route tests (records-proxy shape).
- [x] 1.4 Gates: web vitest green (deep-link-events 4, data/search proxy 3);
      `astro check` at the 84-error pre-existing baseline. → helper =
      `src/lib/deep-link-events.ts` (pure mapping + after-`load` deferred dispatch),
      wired at the top of SchemaBrowse + DataBrowse scripts.
      **Manual smoke owed (human)**: open an MCP `appUrl` — `/schema?entity=<id>` opens
      the entity panel, `/data?record=<id>&table=<t>` opens the record panel.

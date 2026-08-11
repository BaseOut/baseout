# Tasks — shared-multi-destinations

## Status

Per-Space multi-destination: one `storage_destinations` row per (Space, type); primary = `backup_configurations.storage_type`. Spans web + server + workflows (deploy web→server→workflows). Phases 1+2 landed together (type-scoped deletes are the data-loss guard). Built 2026-07-02; all suites green; awaiting human smoke.

---

## 1. Schema + migration

- [x] 1.1 [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts): dropped `.unique()` on `space_id`; added `unique('storage_destinations_space_id_type_unique').on(spaceId, type)`; header comment updated.
- [x] 1.2 `drizzle/0024_multi_destinations.sql` generated (exactly DROP old unique + ADD composite) and **applied to the dev DB** (`db:migrate` green, `db:check` clean).
- [x] 1.3 [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/storage-destinations.ts): mirror header names 0024 + new semantics (columns unchanged; `schema-mirrors.test.ts` green).

## 2. Web persist / disconnect / callbacks (TDD)

- [x] 2.1 Persist helpers ×5 (`lib/{google-drive,box,dropbox,onedrive,local-fs}/persist.ts`): upsert target → `[spaceId, type]`; delete helpers scoped `AND type='<provider>'`.
- [x] 2.2 Disconnect routes ×4: `repointStorageTypeAfterDisconnect` (untouched if not primary; else most-recent remaining row; else `local_fs`). Pure rule in `lib/backup-config/storage-type.ts` + `storage-type.test.ts` (6 cases).
- [x] 2.3 Callbacks ×4: `promoteStorageTypeIfDefault` after persist (promotes only from `r2_managed`/`local_fs`/no-config; never steals an explicit BYOS primary — closes the 2026-06-09 gap).

## 3. Engine resolution (TDD)

- [x] 3.1 `pages/api/internal/spaces/storage-destination.ts`: validated `?type=` (400 pre-DB on unknown); config-join fallback; legacy `LIMIT 1` when config missing/`r2_managed`. Pure resolver `lib/storage/resolve-destination-type.ts` + tests (7 cases); route test extended (`?type=evil` → 400). NOTE: the test pool hosts no Postgres — seeded two-row reads are covered by the pure resolver + web's DB-integration suite instead.
- [x] 3.2 `lib/restores/start-deps.ts`: `fetchStorageDestinationBySpace` resolves by `(space_id, config.storage_type)` with the same fallback; `restores/start.ts` orchestration unchanged (tests green).

## 4. Workflows `?type=` (TDD)

- [x] 4.1 `trigger/tasks/backup-base.ts`: `defaultFetchStorageCreds` gains `storageType`; initial read `?type=` + refresh `?refresh=1&type=`; call site passes `input.storageType`. New `tests/fetch-storage-creds.test.ts` pins both URLs.

## 5. Web loader / mapper (TDD)

- [x] 5.1 `lib/integrations.ts`: all rows, `connected_at DESC`, `IntegrationsState.storageDestinations[]` (`stores/connections.ts`, `EMPTY_INTEGRATIONS_STATE`).
- [x] 5.2 `lib/registry-mappers.ts`: maps the array; `DestinationSummary.id` = provider type; `primary?: boolean` (optional — harness fixtures stay valid) from `policy.storageType`; `toSourceSummary` count text. Tests: two rows → two summaries, single primary, r2 primary → none flagged.
- [x] 5.3 Consumers: `pages/index.astro` (empty state), `pages/backups.astro` (find by storageType), `pages/destinations/detail.astro` (`?id=` = provider type → primary → most recent). `tests/integration/integrations-state.test.ts` rewritten to lists + two-row ordering case (needs `pnpm test:db:up`; Docker unavailable in the build env — compiles green).

## 6. Swap-primary API + UI (TDD for routes/helpers)

- [x] 6.1 PATCH backup-config: `hasConnectedDestination` dep; 422 `destination_not_connected` for BYOS types without a row (managed `r2_managed`/`local_fs` skip the check — disconnect fallback sets local_fs row-lessly); real Drizzle dep wired in the PATCH wrapper; `destination_not_connected` added to save-config `KNOWN_ERRORS`; stale "r2-only" comments corrected in `persist-policy.ts`. 3 new handler tests.
- [x] 6.2 `views/DestinationsView.astro`: `Primary` Badge next to the destination NAME (the status cell's grid track is a fixed 9.5rem — extra content there overflowed into IN USE BY). No swap control in the table rows; swapping lives in the provider boxes below (6.2b).
- [x] 6.2b "What you can connect" boxes on `/destinations` (the boxes from the user's screenshot — previously inert divs): a `primaryType` prop (covers row-less `r2_managed`) marks the primary box; a connected (or managed-R2) box becomes a whole-box `Set primary` button reusing the `data-set-primary` handler; an unconnected BYOS box links to `/destinations/new?type=<slug>`; the local_fs `Connect` button stays.
- [x] 6.3 `views/DestinationAddView.astro` (+ `destinations/new.astro` now loads integrations state): Connected/Primary pills on the provider boxes (existing pill idiom, zero layout change); connected provider screen → "Set as primary" primary action (reuses the `data-managed-connect` handler), OAuth demoted to ghost "Reconnect", "Current primary" state; managed screen shows "Current primary" when applicable.
- [x] 6.4 `views/IntegrationsSetupWizard.astro` + `lib/backups/configure-save.ts`: file-dest radio `value={d.provider}`, `checked` from `d.primary` (i===0 fallback); `commit()` forwards the selected `storageType`; configure-save forwards it + describes `destination_not_connected`. 2 new tests.

## 7. Verification

- [x] 7.1 web: `vitest` 1000/1000, `astro check` 0 errors, `build` green. server: targeted suites 41/41 (resolve-destination-type, storage-destination-route, restores-start(+route), schema-mirrors) + `tsc` clean (full DO suite hangs locally — known). workflows: 200/200 + `tsc` clean. No stray `console.*` in the diff.
- [ ] 7.2 Human smoke: connect Drive + Box on one Space → two registry rows, one Primary → Connected badges on `/destinations/new` → open the non-primary box → "Set as primary" → registry reflects the swap → run a backup, confirm it writes to the new primary → disconnect the primary → storage_type falls back to the remaining destination. (Drive Connect is deployed-only — Google rejects `.local`.)
- [ ] 7.3 Web DB-integration suite (`pnpm --filter @baseout/web test:integration`) once Docker is available (`pnpm test:db:up` first).

## Follow-up (filed, out of scope)

- [ ] Stamp `storage_type` onto `backup_runs` so restore/delete resolve the store the run actually wrote to, not the current primary.

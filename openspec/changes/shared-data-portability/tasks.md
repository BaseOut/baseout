# shared-data-portability — tasks

TDD throughout (CLAUDE.md §3.4): each pure-lib task writes its Vitest suite first. Ordering follows design.md's Migration Plan — every step is independently shippable behind the entitlement gate, and no customer-facing surface is exposed until its bundling task and delivery path exist. Prefix is provisionally `shared-*` (D9); re-scope to a `workflows-*` + `web-*` pair if the enqueue reuses an existing server surface.

## 1. Entitlement gate

- [ ] 1.1 Add a `data_export` (or agreed slug) feature to the DB-native `plan_features` catalog (additive seed; which tiers carry it is Open Question 3 — default per founder decision)
- [x] 1.2 Resolve the gate through `resolveEntitlements(db, orgId)` in both `apps/web` and `apps/server`; add a pure helper + tests asserting entitled/unentitled/no-subscription (null) outcomes — never read a Stripe product string (CLAUDE.md §1) — _2026-08-05: pure `decideDataExportGate(EntitlementMap|null)` in `apps/workflows/trigger/tasks/_lib/data-export-entitlement.ts` reads via `getBool` (never Stripe); tests cover entitled/not_entitled/no_subscription. Route/UI wiring (§1.2 call sites) remains._

## 2. Bundling task (`apps/workflows`)

- [x] 2.1 CSV formula-injection guard reachable from workflows (extract `escapeCsvCell`/`FORMULA_TRIGGERS` semantics from `apps/web/src/lib/csv.ts` into `@baseout/shared`, or re-implement once) + tests: leading `=`,`+`,`-`,`@`, tab, CR, LF neutralized, inner quotes doubled, RFC-4180 quoting — _2026-08-05: re-implemented (D: no shared-pkg edit) in `_lib/export-csv-guard.ts` (`escapeCsvCell` + `FORMULA_TRIGGERS` + `formatGuardedCsv`/`reguardCsv`); tests green._
- [x] 2.2 `_lib` manifest builder + tests: given per-Space/per-Base/per-Table schema (field names + types), record counts, and snapshot timestamps, emit a versioned `manifest.json` (org identity, generatedAt, format, per-base `snapshot: <ts>|null`) — _2026-08-05: `_lib/export-manifest.ts` `buildManifest(...)`; `generatedAt` is an injected param (no `Date.now()` — workerd/test constraint); tests green._
- [x] 2.3 `_lib` snapshot locator + tests: resolve each base's latest completed snapshot prefix via the storage reader (reuse `r2-path.ts` layout, `/`→`_` sanitization); a base with no snapshot yields `null` — _2026-08-05: `_lib/export-snapshot-locator.ts` via injected `Pick<StorageReader,'listKeys'>`; picks latest `{DateTime}` folder, ignores `attachments/`, null when none; tests green._
- [ ] 2.4 `_lib` archive assembler + tests: stream located CSVs (re-emitted through the guard, Task 2.1) into `{SpaceName}/{BaseName}/{TableName}.csv` within a ZIP container; optional `{TableName}.json` per D6 when JSON format selected; never buffer a whole base in memory
- [x] 2.5 Pure `export-archive.ts` orchestration + tests (injected reader / archive sink / progress + notify callbacks): enumerate Spaces/Bases, locate snapshots, assemble archive, compute counts, emit manifest, hand the archive to the sink; fire-and-forget progress; mirror the backup-run lifecycle shape — _2026-08-05: `export-archive.ts` `runExportArchive(input, deps)` fully injected (reader/`ArchiveSink`/`generatedAt`/`postProgress`/`notify`/`guardCsv`), mirrors `runBackupBase`; tests green. §2.4 ZIP assembler deferred (no zip lib in workspace, no-new-deps) — `ArchiveSink` interface defined for it._
- [ ] 2.6 Thin `export-archive.task.ts` wrapper: read `process.env`, build real storage reader + `resolveStorageWriter` sink + callbacks, call the pure module; `type`-export the task reference from `trigger/tasks/index.ts`

## 3. Enqueue + delivery contract (`apps/server`, or reused surface)

- [ ] 3.1 Internal enqueue route (`INTERNAL_TOKEN`-gated) that starts the export task for an org — with server-side input validation and the entitlement re-check (Task 1.2); one in-flight export per org
- [ ] 3.2 Progress + completion callback route(s) mirroring the backup-run `{progress,complete}` contract; on completion record delivery target (Storage Destination key and/or download token) and write the audit row
- [ ] 3.3 Time-boxed authenticated download delivery (if in scope per Open Question 4): org-scoped, expiring, authenticated retrieval of the finished archive — reject foreign-org and expired requests

## 4. Customer surface (`apps/web`)

- [ ] 4.1 "Export all my data" action in the account/Space settings area: org-admin only + entitlement-gated (Task 1.2); one-click initiate with a loading state via `setButtonLoading` (CLAUDE.md §4.5); format selection per D6
- [ ] 4.2 Initiate route: server-side validation, org-admin + gate enforcement in middleware, enqueue via the Task 3.1 surface, CSRF-protected mutating form (CLAUDE.md §3.3)
- [ ] 4.3 Progress/status view (reuse the backup-run polling pattern) and completion notification to the initiator; surface a failure reason on failure
- [ ] 4.4 Retrieval UX: show the delivered Storage Destination location and/or the time-boxed download link per the D7 delivery decision

## 5. Verification & docs

- [ ] 5.1 `pnpm --filter @baseout/workflows test` (bundler/manifest/locator/orchestration) green; `apps/web` + `apps/server` suites green; `tsc --noEmit` clean
- [ ] 5.2 Smoke: seed an org with ≥2 Spaces and completed snapshots, initiate an export, confirm the archive contains `manifest.json` with correct per-table counts + one guarded CSV per table, and that a base with no snapshot is represented as `snapshot: null`
- [ ] 5.3 Security review sign-off per CLAUDE.md §3.3: org-admin gate, org-scoped isolation (no cross-org read), no `*_enc`/plaintext-credential exposure, download-link auth + expiry, audited initiation/delivery, human-safe CSV
- [ ] 5.4 Confirm the final change prefix (`shared-*` vs `workflows-*` + `web-*` pair) against the actual spread and reconcile proposal/design per D9

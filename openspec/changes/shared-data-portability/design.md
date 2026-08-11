# shared-data-portability — design

## Context

The founder's directive out of today's meeting is to prioritize tooling that helps customers get off Airtable and de-risk the platform (Airtable was acquired by Bending Spoons). The building blocks for "export all my data" already exist, but no feature stitches them into a customer-facing exit path:

- **Static-backup CSV pipeline.** The backup task serializes one page of records to CSV via `pageToCsv` (`apps/workflows/trigger/tasks/_lib/csv-stream.ts:38`, RFC-4180 quoting through Papa Parse; non-string cells JSON-serialized for round-trip). Each table becomes one CSV.
- **Snapshot storage layout.** `buildR2Key` (`apps/workflows/trigger/tasks/_lib/r2-path.ts:28-36`) writes every table to `{orgSlug}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv`, and `buildAttachmentKey` co-locates attachments under an `attachments/` subtree. The same relative key is used by every writer.
- **Storage writers.** `resolveStorageWriter` (`apps/workflows/trigger/tasks/_lib/storage-writers/index.ts:51`) dispatches on `storage_type` to Google Drive / Dropbox / Box / OneDrive / managed R2 / local-fs writers, falling back to local disk. `storage_type` and backup `mode` (`static` | `dynamic`) live on `backup_configurations` (`apps/server/src/db/schema/backup-configurations.ts:44,46`).
- **Restore read path.** `runRestoreBase` (`apps/workflows/trigger/tasks/restore-base.ts`) already reads snapshot CSVs back (`listKeys` → `readFile` → `parseCsv` → `denormalizeFieldValue`), proving snapshots are machine-recoverable. But restore *writes back into Airtable* and its `ensureRestoreTarget` is a **throwing stub** — `restore_target_creation_not_implemented`, deferred until write-scope OAuth + the Airtable Meta API exist (`apps/workflows/trigger/tasks/restore-base.ts:155-167`). Restore is not an export.
- **Dynamic mode** already gives portable SQL access to a Baseout/BYODB Postgres — a second existing exit path for Business+ customers, orthogonal to this file-archive export.
- **Existing "export" is documentation, not data.** `openspec/changes/web-schema-export/` + `apps/web/src/lib/csv.ts` export *schema docs* (with a formula-injection guard, `escapeCsvCell` at `apps/web/src/lib/csv.ts:30`, `FORMULA_TRIGGERS` at `:21`), not the records themselves.
- **Entitlements.** Capability gating resolves through `resolveEntitlements(db, orgId, now)` (`apps/web/src/lib/entitlements/resolve.ts`, mirrored in `apps/server/src/lib/entitlements/resolve.ts`) against the DB-native `plan_features` catalog — never Stripe product metadata (CLAUDE.md §1).

The central design tension is the **scope boundary**: the PRD marks *table & record CSV export* as an existing, keep-it capability (`shared/Baseout_PRD.md:132`) but marks *Migration & Cloning* — schema-only cloning, cross-workspace migration, template generation — as **V2** (`shared/Baseout_PRD.md:291-293`). So a "help people leave Airtable" feature is only V1-legal if it stops at producing a portable archive and does **not** attempt to load that data into another platform.

## Goals / Non-Goals

**Goals:**

- A one-click, customer-facing "export all my data" for an entire organization, entitlement-gated through `resolveEntitlements`.
- A single self-contained, self-describing archive: per-Space/per-Base folders, one CSV per table, a root `manifest.json` (schema + record counts + snapshot provenance) — openable and understandable without Baseout.
- Reuse the existing CSV pipeline, snapshot layout, and storage writers; add no new data plane and no new Airtable read pressure.
- Human-safe CSV (formula-injection-guarded) for files a person will open in a spreadsheet.
- Deliver the archive (Storage Destination or time-boxed authenticated download) with progress + completion notification, mirroring the backup-run lifecycle.

**Non-Goals:**

- Writing data **into** any second platform (Airtable base creation, another SaaS). Cross-platform migration/cloning stays V2 (`shared/Baseout_PRD.md:291`) and depends on the write-adapter that leaves `ensureRestoreTarget` a stub.
- Parquet / DB-native / SQL-dump export formats (PRD §2.1 marks these V2).
- New full-text/search or indexing infrastructure.
- Any change to backup-run scheduling, capture, or storage semantics.
- Live re-scan of Airtable at export time (see D2).

## Decisions

### D1 — Ship the V1-feasible slice: portable export, not cross-platform clone

The founder's "migration tools" ambition decomposes into two independent halves: **(a)** get-your-data-out — a portable archive the customer owns; **(b)** load-it-into-another-platform — write records into Airtable-or-elsewhere. Half (b) is the PRD's V2 "Migration & Cloning" (`shared/Baseout_PRD.md:291-293`) and is blocked on the exact write-adapter whose absence makes restore's `ensureRestoreTarget` throw `restore_target_creation_not_implemented` (`apps/workflows/trigger/tasks/restore-base.ts:155-167`). This change ships **(a) only**. It is the highest-leverage de-risking move available now (a customer whose Airtable access is cut can still get every byte out), and it is forward-compatible: when the `system-platform-abstraction` adapter lands, a clone feature can consume this same archive.

*Alternative considered:* wait and ship export + import together as one migration feature — rejected: couples a shippable V1 win to a V2 dependency with no owner yet, and the export alone already satisfies the founder's near-term "help people leave" ask.

### D2 — Export source is the latest completed snapshot, not a live Airtable re-pull

The bundler reads each base's most recent successful backup snapshot (the CSVs already at `{orgSlug}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv`, `apps/workflows/trigger/tasks/_lib/r2-path.ts:28-36`) rather than re-scanning Airtable. This makes export a cheap *bundling* operation: no new Airtable rate-limit pressure, no duplication of the backup engine, and — critically for the "get off Airtable" scenario — it works even after the customer's Airtable connection is gone or invalidated. Each base's `manifest.json` entry stamps the snapshot's `DateTime` so the customer knows exactly how fresh the data is.

*Alternative considered:* fresh live pull at export time — rejected: re-implements the backup task, hammers Airtable, and fails in precisely the disconnection scenario the feature exists for. If a customer wants the very latest, the natural flow is "run a backup, then export" (a UI affordance, not a coupling).

*Consequence / open question:* a base with **no** completed snapshot yet cannot be exported from snapshots; the manifest represents it explicitly as `snapshot: null` and the UI nudges "run a backup first" (Open Questions).

### D3 — Archive shape: per-Space/per-Base folders, one CSV per table, root `manifest.json`

A single ZIP container:

```
manifest.json                       # org identity, generatedAt, per-base schema + counts + snapshot time
{SpaceName}/{BaseName}/{TableName}.csv
{SpaceName}/{BaseName}/attachments/…  # only if attachment inclusion is in scope (Open Questions)
```

The folder layout is the snapshot layout minus the per-run `{DateTime}` segment (one archive = one point in time, stamped once in the manifest). `manifest.json` is machine-readable and carries, per Space → per Base → per Table: the field list + field types, the record count, and the source snapshot timestamp; plus top-level org name/slug, generation time, format, and a schema version for the manifest itself. Segment sanitization reuses `r2-path.ts`'s `/`→`_` rule so names stay filesystem-safe.

*Alternative considered:* one flat CSV-per-base or a single mega-CSV — rejected: loses table boundaries and schema; the per-table layout matches how the data was captured and how restore already reads it back.

### D4 — New `apps/workflows` bundling task, house-style pure module + thin wrapper

`export-archive.ts` (pure orchestration, injected deps: storage reader, archive sink, progress/notify callbacks) + `export-archive.task.ts` (Trigger.dev wrapper reading `process.env`, building real deps). It enumerates the org's Spaces/Bases, locates each base's latest snapshot via the storage reader, streams the CSVs into the archive, computes counts, emits `manifest.json`, and writes the finished archive out via `resolveStorageWriter` (`apps/workflows/trigger/tasks/_lib/storage-writers/index.ts:51`). Progress and completion POST back on a callback shaped like the backup lifecycle. Tests target the pure module with fake readers/sinks (Vitest, node env) per CLAUDE.md §6.

*Alternative considered:* generate the archive inside the Worker or web SSR — rejected: bundling a whole org can exceed Worker wall-clock/memory; long-running archive assembly belongs on the Trigger.dev Node runner, exactly like backup.

### D5 — Human-safe CSV: guard the export files against formula injection

The export's human-facing CSVs SHALL be formula-injection-guarded (leading `=`,`+`,`-`,`@`, tab, CR, LF neutralized) and RFC-4180-quoted, reusing the semantics already shipped at `apps/web/src/lib/csv.ts:21,30`. The backup pipeline's `pageToCsv` (`apps/workflows/trigger/tasks/_lib/csv-stream.ts:38`) is deliberately **unguarded** — correct for a machine round-trip on restore, where guarding would corrupt values. A portable archive is handed to a human to open in Excel/Sheets, so it is a different threat surface (OWASP CSV Injection). The bundler therefore re-emits cells through the guard rather than copying snapshot CSV bytes verbatim.

*Alternative considered:* copy snapshot CSVs byte-for-byte (zero re-serialization) — rejected for the human-facing CSV: it would ship unguarded formulas to a spreadsheet. Verbatim reuse remains acceptable only for the machine-oriented JSON format (D6), which is not opened in a spreadsheet.

*Consequence:* the shared guard should live where both `apps/web` and `apps/workflows` can use it (candidate: `@baseout/shared`), or be re-implemented once in workflows — a small extraction decided at implementation.

### D6 — Record format: CSV baseline, JSON optional

CSV is the guaranteed format (PRD §2.1: "Keep CSV; JSON optional"). When JSON is selected, the archive additionally includes `{TableName}.json` (an array of record objects) alongside each CSV — round-trip-lossless (arrays/objects preserved as native JSON rather than the CSV's JSON-in-a-cell encoding). Format is a per-export flag surfaced in the UI and carried in the manifest. Whether JSON ships in the first cut is an Open Question.

*Alternative considered:* JSON-only or a proprietary bundle — rejected: CSV is the universally importable lowest common denominator and the format the PRD commits to.

### D7 — Delivery: Storage Destination by default, time-boxed authenticated download as convenience

Because backups already land in the org's own storage, the completed archive is written out through `resolveStorageWriter` to the org's configured Storage Destination (BYOS or managed R2) and the customer is notified. For the "just give me the file" case, a **time-boxed, authenticated, org-scoped** download link is offered — a new egress surface that MUST be authenticated (session or short-lived signed token), scoped to the initiating organization, and expiring. Which is the default (and whether the download link ships first) is an Open Question.

*Alternative considered:* stream the archive straight through the web response — rejected: multi-GB archives can't be held in a Worker response; the archive is produced asynchronously and then delivered/linked.

### D8 — Entitlement gate via `resolveEntitlements`; org-admin only

A new `plan_features` catalog entry (e.g. `data_export`) gates the feature; the web surface and the enqueue route both resolve it through `resolveEntitlements(db, orgId)` (`apps/web/src/lib/entitlements/resolve.ts`) — never a Stripe product-name string (CLAUDE.md §1). Initiation is further restricted to organization admins (bulk PII egress). Which tiers get it, and whether it counts against a meter/quota, is an Open Question — given the strategic framing (trust / anti-lock-in), a case exists for making it broadly available, but that is the founder's call.

### D9 — Prefix is `shared-*`, re-scope if the spread narrows

The change touches `apps/web` (UI + routes) + `apps/workflows` (task) + likely `apps/server` (enqueue), so reverting it spans two-plus `apps/*` trees → `shared-*` per CLAUDE.md §3.6. If implementation finds the enqueue reuses an existing server surface and the real spread is `apps/workflows` + `apps/web` only, split into a cross-referenced `workflows-data-portability` + `web-data-portability` pair per §3.6, each single-app.

## Risks / Trade-offs

- **[Snapshot staleness]** — export reflects the last backup, not live Airtable. Mitigated by stamping each base's snapshot timestamp in the manifest and offering a "run a backup first" affordance; not hidden from the user.
- **[Bases with no snapshot]** — cannot be exported from snapshots; represented as `snapshot: null` in the manifest so the archive is honest about what is missing (D2).
- **[Large archives / memory]** — a whole-org bundle can be multi-GB. Streamed assembly on the Node runner (never buffered whole in a Worker); attachment inclusion is gated behind an Open Question precisely because it dominates size.
- **[CSV formula injection]** — real risk once files are human-opened; mitigated by D5's guard on every human-facing CSV.
- **[New bulk-egress surface]** — download links are a new way data leaves Baseout. Mitigated by org-admin gating, org-scoping, authentication, expiry, and audit (D7/D8) — flagged for security review per CLAUDE.md §3.3.
- **[Guard extraction / duplication]** — the formula guard must be reachable from `apps/workflows`; either extract to `@baseout/shared` or re-implement once. Small, contained (D5).
- **[Scope creep toward V2]** — pressure to "also import into X" will follow. Held off by D1's explicit boundary and Open Question 1 confirming the founder accepts export-only for V1.

## Migration Plan

Pure code plus one additive `plan_features` catalog row — no destructive DB migration; export reads existing snapshots and master-DB metadata the org already owns. Suggested order (each step independently shippable behind the entitlement gate):

1. Entitlement feature (`data_export`) seeded in the `plan_features` catalog; gate wired through `resolveEntitlements`.
2. `apps/workflows` bundling task: pure `export-archive.ts` + manifest/bundler `_lib` helpers + the CSV guard, Vitest-first; then the thin `export-archive.task.ts` wrapper.
3. `apps/server` (or reused) internal enqueue route + progress/complete callback contract.
4. `apps/web` surface: initiate action (org-admin + gate), progress/status view, delivery (Storage Destination write and/or download link) + completion notification.

Rollback = remove the surface / disable the entitlement; nothing to unwind (no data mutated).

## Open Questions

1. **PRD §3.8 V2 boundary (for the founder).** Is a V1 **portable-export** — a customer archive of all their data, with **no** write-into-another-platform — the right near-term slice, given cross-platform clone/migration stays V2 (`shared/Baseout_PRD.md:291-293`) pending the `system-platform-abstraction` write-adapter? This design assumes yes.
2. **Archive format (for the founder).** CSV-only for the first cut, or CSV + JSON (D6)? And does the archive include **attachments/binary** (full-fidelity, potentially huge) or metadata + record data only?
3. **Tiers & metering (for the founder).** Which tiers get the export, and does it count against any meter/quota — or is it a universal, un-metered trust/retention feature (the anti-lock-in framing argues for broad availability)? (D8.)
4. **Delivery default.** Write to the org's configured Storage Destination, a time-boxed authenticated download link, or both — and if a link, does it ship in the first cut (new signed-URL surface)? (D7.)
5. **Export source freshness.** Latest-completed-snapshot (D2, assumed) vs an optional "back up now, then export" one-shot; and the exact UX for bases with no snapshot yet.
6. **Guard location.** Extract the CSV formula guard to `@baseout/shared` for reuse across `apps/web` + `apps/workflows`, or re-implement once in workflows? (D5.)

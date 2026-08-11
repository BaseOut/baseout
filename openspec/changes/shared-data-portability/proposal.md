# shared-data-portability

## Why

Airtable was acquired (Bending Spoons). Customers now carry acquisition risk on the platform their operational data lives in, and the founder wants to prioritize migration/exit tooling that de-risks that dependency — the pitch shifts from "we back up your Airtable" to "we help you get *off* Airtable if you need to." Today Baseout can produce that data (the backup engine already writes one CSV per table per base to disk / BYOS / managed R2 in a canonical layout), but there is **no customer-facing "export all my data / leave Airtable" feature**: backups land in storage the customer configured for *durability*, not as a single, self-describing, hand-it-to-anyone archive. A customer who wants to walk away today has to reverse-engineer the snapshot folder layout across every Space themselves.

This change ships the near-term, V1-feasible slice of the founder's migration ambition: a one-click **portable full-export** — "download all my data" — that assembles every base's latest snapshot across all of the organization's Spaces into one self-contained archive with a machine-readable manifest (schema + record counts). It reuses the existing CSV pipeline and storage writers, so it is a *bundling* feature, not a new data plane. It deliberately stops short of loading that data *into* another platform (cross-platform clone/migration), which the PRD scopes to V2 (`shared/Baseout_PRD.md:291`) and which depends on a write-adapter Baseout does not have yet.

## What Changes

- **Customer-facing "Export all my data" surface (`apps/web`).** A new tier-entitled action on the account/Space settings area lets an organization admin initiate a full-organization export in one click, see it progress, and retrieve the finished archive. Entitlement is resolved through the DB-native `resolveEntitlements(db, orgId)` choke point (`apps/web/src/lib/entitlements/resolve.ts`) per CLAUDE.md §1 — never a Stripe product-name string.
- **Portable-export bundling task (`apps/workflows`).** A new Trigger.dev task reads each base's **latest completed snapshot** (the existing per-table CSVs) via the storage readers, repackages them into a single archive organized `{SpaceName}/{BaseName}/{TableName}.csv` with a root `manifest.json` (org identity, generation time, per-base/per-table schema + record counts, and each base's snapshot timestamp), and writes the archive out through the existing `resolveStorageWriter` factory. Pure-orchestration module + thin task wrapper, mirroring the backup/restore house style.
- **Enqueue + delivery plumbing.** An internal enqueue path (likely a new `/api/internal/*` route in `apps/server`, or reuse of the existing enqueue surface) starts the task; the finished archive is delivered either to the organization's configured Storage Destination or as a time-boxed, authenticated download link, and the initiator is notified on completion — the progress/notification lifecycle mirrors backup runs.
- **Human-safe CSV.** The export's human-facing CSVs are neutralized against spreadsheet formula injection and RFC-4180-quoted, reusing the guard semantics already shipped for schema export (`apps/web/src/lib/csv.ts:30`). The backup pipeline's `pageToCsv` (`apps/workflows/trigger/tasks/_lib/csv-stream.ts:38`) is intentionally unguarded for machine round-trip; a customer archive opened in Excel is a different threat surface.

Out of scope (explicit): writing data **into** a second platform (creating Airtable bases, pushing to another SaaS) — that is cross-platform migration/cloning, deferred to V2 by `shared/Baseout_PRD.md:291-293` and blocked on the same missing write-adapter that leaves restore's `ensureRestoreTarget` a throwing stub (`apps/workflows/trigger/tasks/restore-base.ts:155-167`). Also out of scope: new full-text/search infrastructure, Parquet/DB-native export formats (PRD §2.1 marks these V2), and any change to backup-run semantics.

## Capabilities

### New Capabilities

- `data-portability`: the customer-initiated full-organization portable export — its entitlement gate, the archive shape (per-Space/per-Base CSV layout + `manifest.json`), the optional JSON record format, human-safe CSV serialization, delivery (Storage Destination or time-boxed download link), progress + completion notification, the metadata/data boundary and audit, and the explicit exclusion of cross-platform write.

### Modified Capabilities

_None in `openspec/specs/`. This change adds a new customer-facing capability on top of the existing static-backup CSV pipeline; it does not alter, supersede, or archive any existing backup/restore/storage requirement. The existing schema-documentation export (`openspec/changes/web-schema-export/`) is documentation-only and disjoint from this data export._

## Impact

- **Cross-app (`shared-` prefix).** The change spans `apps/web` (customer UI + initiate/retrieve route), `apps/workflows` (the bundling task + pure helpers + tests), and likely `apps/server` (internal enqueue route) — reverting it touches two-plus `apps/*` trees, so it is `shared-*` per CLAUDE.md §3.6. If implementation finds the enqueue can reuse an existing server surface and the change collapses to a `workflows-*` + `web-*` pair, the prefix SHOULD be re-scoped then (§3.6 "where the boundary blurs").
- **Code:** new `apps/workflows` task (`export-archive.task.ts` + pure `export-archive.ts` + `_lib` bundler/manifest helpers, Vitest first); a shared/ported CSV formula-guard; new `apps/web` settings surface + initiate/status/retrieve routes + notification wiring; a new internal enqueue route in `apps/server` (or reuse). Reuses `csv-stream.ts`, `r2-path.ts`, the storage readers/writers, and the run-lifecycle callback shape.
- **Data / entitlements:** one new entitlement feature in the DB-native `plan_features` catalog (which tiers get it is an open question), resolved via `resolveEntitlements`. No destructive DB migration; export reads the org's own existing snapshots + master-DB metadata it already owns.
- **Security (bulk data egress — review points per CLAUDE.md §3.3):** a NEW customer-facing bulk-export surface. Initiation restricted to org admins and entitlement-gated; every export reads only the initiating organization's snapshots and never another org's; never `*_enc` token columns or plaintext credentials; download links (if used) are authenticated, org-scoped, and time-boxed; initiation and delivery are audited; human-facing CSV is formula-injection-guarded. These are called out for explicit security review before approval.
- **Coordination:** references the `system-platform-abstraction` adapter change (filed alongside this one) as the future dependency for true cross-platform migration; this change is independent of it and ships the export-only slice now.

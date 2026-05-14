## Recommendations — proposed sequence

> **Note (2026-05-13 update):** the pulled OpenSpec changes have already executed Round 0 (split `baseout-backup` into 9 per-capability proposals). Rounds 1-9 below remain the recommended ordering, mapped to the new proposal names. See [05-update-2026-05-13b.md](./05-update-2026-05-13b.md) §Recommended next moves (updated) for the post-pull next-step list.



Goal: ship something that backs up a real Airtable base end-to-end and surfaces the result in `apps/web`, without painting into a corner on the deferred work.

### Order of operations

#### Round 0 — Reconcile the proposals (1-2 sessions)

Before any net-new code, do these in lockstep:

1. **Rewrite `baseout-backup/proposal.md`** to target `apps/server` with the two-Worker collapse explicit. Split capabilities by Phase so the next implementation cycle has a clear, in-scope vehicle. (See `03-reconciliation.md` §1.)
2. **Archive `web-client-isolation`** as accepted principle. Add the proxy-only rule to the change template / review checklist so future `apps/web` changes default to the right wire shape.
3. **Decide on `@baseout/db-schema` extraction.** If yes → propose `baseout-db-schema` extraction as a small, focused change before backup MVP starts. If no → document the mirror-stays-canonical decision and accept the maintenance tax.
4. **Reconcile PRD v1.1** against the proposals being reopened.

**Outcome:** a backup MVP proposal that names the exact `apps/server` files, the exact schema rows, the exact wire format, and zero references to six Workers / `baseout-backup` repo / `baseout-webhook-ingestion`.

#### Round 1 — Server backup MVP (Phase 1 of `baseout-backup`)

Smallest end-to-end backup that proves the topology:

1. Airtable client in `apps/server/src/lib/airtable/`: schema discovery (list bases / tables / fields / views) + record fetch with pagination + 429 handling + cursor advancement.
2. Per-Connection `ConnectionDO`: real rate-limit budget + queue + contention retry (5s budget per `baseout-backup` design).
3. Per-Space `SpaceDO`: state machine that picks up the trigger from `apps/web` and dispatches one Trigger.dev task per base.
4. Trigger.dev `backup-base` task: full implementation — fetch records, stream as CSV, write to R2 under `/{user-root}/{Space}/{Base}/{DateTime}/{Table}.csv`.
5. `backup_runs` lifecycle (DB row already exists; engine writes `running → succeeded|failed`); `backup_run_bases` per-base verification rows.
6. Trial cap enforcement (1K records / 5 tables / 100 attachments → `trial_complete` + email).
7. Idempotent `POST /api/internal/runs/{id}/start` (already exists; wire it through).

**Defer in Round 1:** attachments (do schema/records first; attachments come right after), BYOS (R2 only), webhook coalescing, restore, schema diff, health score.

#### Round 2 — Web Run-Now + WebSocket progress

Now that the server can actually back up:

1. **`baseout-web-run-now`** — reintroduce the Run-Now button on `/backups`. Service-binding proxy from `apps/web` to `apps/server`'s `/api/internal/runs/{id}/start`. Browser never sees the server.
2. **`baseout-web-websocket-progress`** — `apps/web` exposes `wss://{host}/api/ws/spaces/{id}/progress`. Cross-Worker DO namespace binding to `SpaceDO`. Browser opens the socket on `apps/web`; frames proxy through.
3. Update `BackupHistoryWidget` to consume WS events instead of (or alongside) 2s polling.

#### Round 3 — Attachments + restore

1. Server-side: attachment R2 streaming with composite-ID dedup `{base}_{table}_{record}_{field}_{attachment}`. Attachment URL refresh when within 1h of expiry.
2. Restore engine: base / table / existing-base-new-table scope. `POST /api/internal/restores/{id}/start`. `/api/web/restores/{id}/start` proxy. Restore UI in `apps/web` (`baseout-web-restore-full`).

#### Round 4 — Background services (one cron per change)

Each gets its own `opsx:propose <name>`:

- `baseout-server-cron-webhook-renewal`
- `baseout-server-cron-trial-expiry`
- `baseout-server-cron-quota-monitor`
- `baseout-server-cron-smart-cleanup`
- `baseout-server-cron-dead-connection-cadence`
- `baseout-server-cron-connection-lock-manager`

OAuth refresh is already shipped; mirror its task structure.

#### Round 5 — Storage destinations

1. **`baseout-web-byos-storage`** — Storage destination OAuth flows in `apps/web` (Drive / Dropbox / Box / OneDrive / S3 / Frame.io). Schema decision on `connections` shape (single table vs. dedicated `storage_destinations`).
2. Server-side: `StorageWriter` interface + per-provider strategies in `apps/server/src/lib/storage/`. R2 strategy refactor into the new interface.

#### Round 6 — Dynamic mode + schema diff + health score

Backup writes to client DB instead of (or alongside) CSV-to-R2. D1 / Shared PG / Dedicated PG / BYODB provisioning. Schema diff engine. Health score rule engine. UI: `baseout-web-schema-ui` (React Flow + changelog).

#### Round 7 — Webhook coalescing + inbound API

If the `apps/server` collapse is accepted, both ship in `apps/server` with public-routed receivers (HMAC-gated as the §5.2 exception). If not, build `apps/hooks` + `apps/api` first.

#### Round 8 — Stripe full + credits + emails

`baseout-web-stripe-full`, `backup-credit-consumption`, `backup-email-notifications` + Mailgun migration (`baseout-web-mailgun`).

#### Round 9 — On2Air migration script

Standalone entry point in `apps/server/src/migration/`. Manual invoke. Dry-run + idempotent.

### Cross-cutting principles for each round

- **Test-first** per `CLAUDE.md` §3.4. Integration tests hit real Postgres + real Miniflare bindings, not mocks. External APIs (Airtable, Stripe, BYOS) mocked at HTTP boundary via msw.
- **No drive-by refactors** per `CLAUDE.md` §3.2.
- **Service binding only** between `apps/web` and `apps/server`. Never raw HTTP.
- **Schema migrations owned by `apps/web`.** `apps/server` mirrors (or imports from `@baseout/db-schema` if extracted).
- **Each round = its own openspec change** with proposal + design + tasks. No multi-round mega-PRs.
- **`INTERNAL_TOKEN` stays** as defense-in-depth even with service bindings.

### Anti-recommendations

Things worth not doing yet:

- Don't extract `packages/ui` until a second consumer exists.
- Don't migrate to Mailgun until server-side email templates are coming.
- Don't add password / 2FA / SAML until a customer asks.
- Don't build `apps/admin` until `/ops` outgrows `apps/web`.
- Don't pre-extract `@baseout/shared/airtable` until the third Airtable consumer materializes.
- Don't add lazy refresh inside backup tasks; let the cron drive `invalid_grant` near zero first.

### Open questions for the user

1. Are you OK with the two-Worker collapse being made explicit in the spec (Resolution A in `03-reconciliation.md` §1)?
2. Do you want `@baseout/db-schema` extracted before or after backup MVP?
3. Round 1 priority: attachments included in MVP, or strictly schema + records first?
4. Trigger.dev account exists for dev + staging + production, or is provisioning still pending?
5. Hyperdrive IDs and KV namespaces for staging + production — provisioned, or still placeholder?

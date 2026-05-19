## Overview

Most of the technical design is inherited from [`server-byos-destinations/design.md`](../server-byos-destinations/design.md). This file records only the **MVP-specific narrowing decisions** that distinguish this change from the umbrella. When the umbrella design and this design disagree, this design wins for MVP work; the umbrella's broader decisions resume when each per-provider follow-up change opens.

## Narrow the `type` CHECK constraint to MVP values

Umbrella design ([`server-byos-destinations/design.md` §Phase A](../server-byos-destinations/design.md)) defines the constraint as:

```sql
type text NOT NULL CHECK (type IN ('r2_managed','google_drive','dropbox','box','onedrive','s3','frame_io','custom'))
```

MVP migration uses the narrow form:

```sql
type text NOT NULL CHECK (type IN ('r2_managed','google_drive','dropbox'))
```

Each per-provider follow-up change extends the constraint via `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT`. This keeps the invariant truthful: a row's `type` column always names a provider we actually support. If we shipped the umbrella's full enum now, the database would permit (and a buggy code path could insert) a `'box'` row with no strategy class to execute against it.

## Drop S3-specific columns from MVP migration

S3 is the only destination type that uses IAM access keys instead of OAuth (umbrella design §Phase A). MVP defers S3, so the columns `s3_access_key_id_enc`, `s3_secret_access_key_enc`, `s3_region`, `s3_bucket`, `s3_prefix` **do not land** in the MVP migration. They get added back by the future `server-byos-s3` change as a separate `ALTER TABLE`.

This matches the "no pre-emptive abstraction" rule from [CLAUDE.md §3.2](../../../CLAUDE.md): YAGNI until S3 actually ships.

## `StorageWriter` interface lands fully — only the factory is narrowed

The interface in `apps/server/src/lib/storage/storage-writer.ts` matches the umbrella design byte-for-byte (`init`, `writeFile`, `getDownloadUrl`, `delete`, optional `proxyStreamMode`). Narrowing the interface to "Drive + Dropbox only" would lock in design debt — the interface is what the future per-provider changes consume; if it changes shape each time, every provider has to be re-touched.

The **factory** (`makeStorageWriter`), however, only knows about the three MVP `type` values. Adding a new provider is the second-most-common reason to edit `makeStorageWriter`; the umbrella design already lists this as an "open a new file under `strategies/`" pattern. Future provider changes add a new `case 'box':` (etc.) branch to the dispatch.

## `R2ManagedWriter` lives in apps/server, BYOS writers live in apps/workflows

The umbrella designs split is preserved verbatim:

- `apps/server/src/lib/storage/strategies/r2-managed.ts` — uses the `env.BACKUPS_R2` Worker binding. Only callable from inside the Worker.
- `apps/workflows/trigger/tasks/_lib/storage-writers/{google-drive,dropbox}.ts` — pure HTTP. Callable from the Node Trigger.dev runner.

Where this gets awkward: the workflows runner can't reach the `BACKUPS_R2` binding, but R2 is still a valid destination (the default in fact). The umbrella design references a proxy upload route on the engine that the workflows runner POSTs through. That proxy route is **not** in this change's scope — Phase E.1 only covers `loadStorageDestination`. The R2 proxy upload route is needed when the engine wires the writer call site for default-R2 backups (workflows-byos-destinations §2 in the umbrella) — that's mostly orthogonal to Drive + Dropbox, which never need the proxy.

For the Drive + Dropbox MVP test, the user must pick a non-R2 destination on their Space; otherwise the workflows task will hit the missing R2-proxy route and fail. The StoragePicker UI defaults to `r2_managed`, so users will need to explicitly switch. This is documented in the smoke checklist (Phase H).

## OAuth Connect URL shape

Umbrella design uses `/api/connections/storage/<provider>/{authorize,callback}`. This change matches verbatim — it's a clean namespace under `/api/connections/` that keeps storage-destination Connect flows visibly separate from data-source connections (Airtable). The existing Airtable Connect lives at `/api/connections/airtable/{start,callback}` so the `start`-vs-`authorize` verb mismatch is acknowledged but not changed (the project's `connections/` directory already contains both verbs for legacy reasons).

## Cookie-based handoff, not `oauth_states` table

The umbrella design proposes an `oauth_states` table for CSRF. This change keeps the table (Phase A.3) but uses it as a **defense-in-depth** layer behind a sealed cookie — the **primary** state container is a sealed encrypted cookie following the Airtable pattern ([apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts)). Rationale:

1. Airtable's flow already uses sealed-cookie handoff and works. Re-using the pattern means the Drive + Dropbox flows can share the same `sealHandoffPayload` / `unsealHandoffPayload` helpers, which is the YAGNI-justified extraction trigger (three real call sites: Airtable + Drive + Dropbox).
2. The `oauth_states` table catches the edge case where the cookie is missing (cleared by the browser, OAuth flow took >cookie's MaxAge). Without it, the user just sees a generic state-mismatch error; with it, the engine can correlate the inbound `state` to the originating Space/user and produce a clearer "session expired, please retry" message.

The lib/oauth/ extraction (sealed cookie + PKCE helpers) is performed as part of Phase C.3 (the second non-Airtable call site), per [CLAUDE.md §3.2](../../../CLAUDE.md).

## Token refresh strategy: lazy + on-401, NOT cron

Umbrella design's Operational Concerns section gives lazy-refresh-in-`init()` as the MVP path with cron-extension as a follow-up. MVP commits to **lazy refresh inside `StorageWriter.init()` plus on-401 retry inside `writeFile`**. The Phase E.1 engine route runs the refresh under transactional lock and persists the new tokens before returning them to the workflows runner.

A separate follow-up change (existing OUT-6) extends [`server-cron-oauth-refresh`](../server-cron-oauth-refresh/proposal.md) to proactively refresh `storage_destinations.oauth_access_token_enc` 15 minutes before expiry. That moves refresh load off the request path. Out of scope for MVP — measured first.

## Folder creation: auto-create one per Space, no picker

Umbrella design notes "create `Baseout-<spaceId>` on first init if absent" for Google Drive and uses a Dropbox path `/Baseout/spaces/<spaceId>`. MVP matches this verbatim — **no GUI folder picker**. The user gets one Baseout-managed folder per Space, populated automatically on first connect.

The follow-up `server-byos-folder-picker` (existing OUT-2) layers a real picker on top. That's a UX enhancement, not a correctness gate.

## Testing strategy (narrowed)

Umbrella design lists six testing layers. MVP scope hits five:

| Layer | What MVP exercises |
|---|---|
| Pure | `makeStorageWriter` dispatch — `r2_managed`, `google_drive`, `dropbox` map to correct classes; an unknown `type` throws. |
| Pure | `resolveStorageDestinations(tier)` — every tier returns at least `['r2_managed', 'google_drive', 'dropbox']`. Other types not yet tested. |
| Per-strategy unit | `google-drive.ts` + `dropbox.ts` writers — mock the HTTP boundary; assert each `StorageWriter` method's call shape, retry on 401/429/503, error surfaces typed. |
| OAuth flow | `<provider>/{authorize,callback}.test.ts` for Drive + Dropbox — state cookie set + redirect URL correct on authorize; state match + token-exchange success + encrypted persistence on callback. |
| Integration | `backup-base.task.byos.test.ts` — seeded `storage_destinations` row for each of `r2_managed` (proxy), `google_drive`, `dropbox`; assert the per-base task instantiates the right strategy. |
| Smoke (manual) | Per provider, real OAuth on a dev account, run a backup, verify the file lands. |

The Playwright integration layer from the umbrella design (wizard OAuth flow end-to-end with mocked provider) is deferred to a follow-up under the `web-ai-verify` policy — Claude verifies UI changes via the Playwright MCP per existing convention, not a hand-written .spec.ts file.

## What this design deliberately doesn't change

Identical to the umbrella's closing section:

- Per-base task envelope (Trigger.dev v3, `maxDuration: 600`, ConnectionDO lock).
- CSV format.
- Restore path (out of scope; future change consumes `getDownloadUrl`).
- Retention engine (managed R2 only consumes `writer.delete(path)`; BYOS retention is customer-managed per [Features §6.6](../../../shared/Baseout_Features.md)).
- Encryption-key shape (same AES-256-GCM helper from `@baseout/shared`).

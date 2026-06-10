# system-r2-revive

> **Supersedes**: the architecture clause of [`system-r2-stance`](../archive/2026-05-18-system-r2-stance/proposal.md) ("R2 returns via the `BACKUPS_R2` Worker binding under `server-byos-destinations` Phase 0") and reverses the R2 pause introduced by commit `37fb95a` (scope `system-r2-park`).

## Why

[PRD §7.2](../../../shared/Baseout_PRD.md) lists **Cloudflare R2 (Baseout-managed)** as the all-tiers **default** storage destination, alongside the BYOS providers (Google Drive, Dropbox, Box, OneDrive — all tiers; S3, Frame.io — Growth+). The product intent has always been that **R2 and BYOS coexist**: R2 is the zero-config default that makes the trial work on day 0; BYOS is the bring-your-own alternative.

Two deviations accumulated:

1. **R2 was paused.** Commit `8fc1f61` removed R2 to unblock local-dev iteration (CSVs write to local disk); commit `37fb95a` ("system-r2-park") then flipped the MVP default to BYOS Google Drive and deleted the remaining R2 strategy. On the runner today, `storageType === 'r2_managed'` silently falls through to `LocalFsWriter` — there is no R2 writer.
2. **The revival plan went stale.** `system-r2-stance` and `server-byos-destinations` Phase 0 both say R2 returns as a Cloudflare Worker `BACKUPS_R2` binding. But backups moved to Trigger.dev's **Node runner** (`apps/workflows`), which has no Workers bindings. That instruction can no longer be executed as written.

This decision re-aligns with the PRD and fixes the architecture so the downstream code changes have a correct target.

## What Changes

This is a **docs/decision change** — no runtime code. It records:

### Decision 1 — R2 is the default; R2 and BYOS coexist

`r2_managed` is the default destination for a Space with no explicit BYOS connection, per PRD §7.2. BYOS destinations remain fully supported. Selection is per-Space via `backup_configurations.storage_type`. Both static-table CSVs and attachments write to whichever destination a Space selects.

### Decision 2 — R2 runs on the Node runner via the S3-compatible API

R2 is accessed from `apps/workflows` (Trigger.dev Node runner) using R2's **S3-compatible API** (`https://<account_id>.r2.cloudflarestorage.com`, SigV4 with an access key + secret), **not** a Cloudflare Worker `BACKUPS_R2` binding. The binding-based instructions in `system-r2-stance` and `server-byos-destinations` Phase 0 are explicitly invalidated.

### Decision 3 — R2 credentials are app-level env, not per-Space OAuth

R2 creds (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) are app-level secrets set in the Trigger.dev runner's env-vars UI and read via `process.env`. R2 is **not** a `storage_destinations` row (the table's CHECK constraint correctly excludes `r2_managed`), is **not** served by `GET /api/internal/spaces/:spaceId/storage-destination`, and involves no OAuth flow or redirect URI. This keeps R2 fully isolated from the Airtable/BYOS OAuth code paths.

### Decision 4 — Where the code lands

- R2 `StorageWriter` (S3-API) + factory registration + runner cred plumbing → [`workflows-r2-writer`](../workflows-r2-writer/proposal.md).
- Binary `writeBlob` across all writers + attachment downloader → [`workflows-attachments`](../workflows-attachments/proposal.md).
- `attachment_dedup` table + `/api/internal/attachments/lookup` route → [`server-attachments`](../server-attachments/proposal.md).

## Out of Scope

| Deferred to | Item |
|---|---|
| `workflows-r2-writer` | The actual R2 `StorageWriter` implementation. |
| `server-byos-destinations` | The Worker-side `StorageWriter` interface this change deprecates; that proposal is left in place but its Phase 0 is marked stale by the edits in tasks.md. |
| Future `system-r2-bucket-topology` | Whether dev/staging/prod share one R2 bucket or use separate buckets. Key prefixes already namespace by `orgSlug`; the decision is operational, not architectural. |

## Impact

- **No code.** Edits are confined to `.md` proposal/README files plus this new change directory.
- **Unblocks** `workflows-r2-writer` and the attachment changes by giving them a correct, current architecture to target.
- **Security:** R2 creds are app-level secrets per [CLAUDE.md §3.3](../../../CLAUDE.md), set in Trigger.dev's env-vars UI (not `.dev.vars`, since the runner is Trigger.dev-hosted, not a Worker). No OAuth, no new redirect URI, no change to the Airtable/BYOS connection surface.

## Reversibility

Docs-only — `git revert` restores the prior stance text. The code changes it unblocks carry their own reversibility notes.

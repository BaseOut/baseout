# system-r2-launch

> **Depends on**: [`system-r2-revive`](../system-r2-revive/proposal.md) (architecture decision), [`workflows-r2-writer`](../workflows-r2-writer/proposal.md) (R2 writer code), [`workflows-attachments`](../workflows-attachments/proposal.md) (`writeBlob` for attachments), [`server-attachments`](../server-attachments/proposal.md) (engine dedup routes).
>
> All four are **already shipped**. This change is the last-mile provisioning + verification + documentation that lets a Space with `storage_type='r2_managed'` actually run a backup end-to-end.

## Why

[PRD §7.2](../../../shared/Baseout_PRD.md) lists Cloudflare R2 as **"✅ V1 (new — internal managed storage)"**. [Features §4](../../../shared/Baseout_Features.md) line 256 makes R2 (Managed) available to **every tier from Trial through Enterprise**. Features §7 (line 451) explicitly says: *"When using Baseout-managed storage (Cloudflare R2), files are stored on Baseout servers subject to plan storage limits."* The product narrative — to customers, to Stripe metadata, to onboarding — assumes R2-managed exists as the zero-config default that makes a trial usable on day 0.

The application code for that flow is finished. What's missing is operational:

1. **No R2 buckets exist** for the current monorepo's environments. Inspection of `apps/server/wrangler.jsonc` (dev/staging/prod blocks), `apps/web/wrangler.jsonc` (all envs), and `apps/workflows/.env*` shows no `R2_*` bindings or credentials anywhere. The legacy `dev/baseout/baseout-backup-engine/wrangler.jsonc` references buckets (`baseout-backups-dev` etc.) and an account ID (`f094d60e8a0996752eb1efd971bda45a`), but those buckets were never re-provisioned for this branch's split architecture, and the buckets that did exist used Worker bindings (no S3 keys were ever generated).
2. **No S3-API tokens exist.** [`system-r2-revive`](../system-r2-revive/proposal.md) Decision 2 mandated S3-API access because backups run on Trigger.dev's Node runner (no Worker bindings reachable). Generating those tokens is a Cloudflare dashboard action, not a code action.
3. **No Trigger.dev env vars are set.** `apps/workflows/.env.example` documents that `R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET` are required when `storage_type='r2_managed'` is dispatched — but the live values aren't set in the Trigger.dev Development / Staging / Production environments.
4. **R2 has never been smoke-tested end-to-end on this architecture.** The legacy Worker-binding path was last exercised before commit `8fc1f61` removed it. The new S3-API path has unit tests (`apps/workflows/tests/storage-writers/r2.test.ts`) but no live-bucket integration verification — nor any verification that the attachment-dedup loop (lookup → download → record → re-run dedup hit) works against R2's `writeBlob` implementation.
5. **No operator runbook exists.** OAuth provider setup has the canonical `shared/internal/oauth-setup.md` audit-trail file (per [CLAUDE.md §3.7](../../../CLAUDE.md)). R2 has nothing equivalent. When a future engineer onboards, or a token rotates, or a bucket migrates, there's no documented procedure — and the cost of getting it wrong is "managed-tier backups silently fail" until someone notices.

Until these five gaps close, every Space configured for R2-managed will trip the visible-failure path that `workflows-task-startup-error-reports` added (the `missing_r2_creds` failure surfaced on 2026-06-09). That's not a regression — it's the safety net catching the missing provisioning. Closing the provisioning gap is the actual remediation.

## What Changes

This change is **operational + documentation**. No runtime code is modified.

### 1. Cloudflare provisioning (dashboard work)

Provision a managed R2 bucket and a bucket-scoped S3-API token for each environment. Names match the legacy engine convention so the historical record stays useful:

- `baseout-backups-dev` — used by the `baseout-server-dev` engine + `apps/workflows` Trigger.dev Development environment.
- `baseout-backups-staging` — used by `baseout-server-staging` + Trigger.dev Staging.
- `baseout-backups-prod` — used by `baseout-server` (prod) + Trigger.dev Production.

Each token is scoped to its bucket (least privilege). The shared `R2_ACCOUNT_ID` (`f094d60e8a0996752eb1efd971bda45a`, already documented in the legacy engine's `wrangler.jsonc`) is reused across all envs.

### 2. Trigger.dev env-var wiring (dashboard work)

Per environment, set the four `R2_*` vars in the Trigger.dev project's Environment Variables UI. This is the canonical location because tasks run on Trigger.dev's Node runner — see [`system-r2-revive`](../system-r2-revive/proposal.md) Decision 3 — not in `.dev.vars` (Cloudflare) and not in repo files.

For local `npx trigger.dev dev`, the same four vars are added to `apps/workflows/.env` (already documented in `apps/workflows/.env.example`).

### 3. Per-env smoke verification

End-to-end backup against a real R2 bucket, exercising the full code path:

- Trigger.dev task picks up `storage_type='r2_managed'` payload.
- Resolves `R2Writer` via `getR2Creds()` (not `fetchStorageCreds`, per `system-r2-revive` Decision 3).
- Writes per-table CSVs via SigV4 PUT to `<orgSlug>/<spaceName>/<baseName>/<runStartedAt>/<tableName>.csv`.
- For attachment cells: engine `/attachments/lookup` returns empty hits, downloader streams from Airtable CDN, `R2Writer.writeBlob` SigV4 PUTs the attachment to `<orgSlug>/<spaceName>/<baseName>/attachments/<compositeId>/<filename>`, engine `/attachments/record` upserts.
- `postCompletion` flips `backup_runs.status` to `succeeded` with non-zero `attachment_count`.
- **Second run** of the same Space exercises dedup — `/attachments/lookup` returns the storage keys from the first run, downloader skips the CDN download, `R2Writer.writeBlob` is NOT called for already-recorded composite IDs.
- A **`deletePrefix`** smoke (driven by the existing per-run delete path) confirms cleanup works (`ListObjectsV2` + batch `DeleteObjects`).

Each env (dev → staging → prod) goes through the same smoke before its rollout is considered done.

### 4. Runbook docs

A new `shared/internal/r2-setup.md` (matching [`shared/internal/oauth-setup.md`](../../../shared/internal/oauth-setup.md)'s structure) becomes the canonical audit-trail for R2 across envs. Required sections:

- **§1 Environments** — bucket name, account ID, Trigger.dev env mapping per env.
- **§2 Cred lifecycle** — how tokens are minted, scoped, rotated; what to do on suspected compromise.
- **§3 Per-env provisioning status** — checklist mirroring oauth-setup.md §3 (✅ done / ❌ MISSING per item).
- **§4 Gap checklist** — actionable items.
- **§5 Verification protocol** — the smoke from this change, scripted as a re-runnable checklist.
- **§6 Failure modes** — `missing_r2_creds`, `invalid_path`, SigV4 signature failures, bucket-not-found, IAM 403, listing pagination edge cases.
- **§7 Cost monitoring** — note where to watch R2 storage + Class A/B operation counts in the Cloudflare dashboard. PRD doesn't define alert thresholds; this section captures where to add them when they're defined.

[CLAUDE.md §3.7](../../../CLAUDE.md) is updated in the same change to add R2 to the **"Consult the Runbook First"** rule (currently only OAuth). The rule is "before any change that touches R2 cred resolution, bucket naming, or `R2Writer` behavior, read `shared/internal/r2-setup.md` and update it in the same change."

### 5. Auto-memory updates

- Mark `project_r2_documented_pause.md` superseded by this change (R2 is no longer paused — it's live).
- Add a new memory pointing at `shared/internal/r2-setup.md` as the per-env source-of-truth for R2 provisioning (parallel to the existing OAuth runbook memory).

### 6. Example-file updates

- `apps/workflows/.env.example` — confirm the `R2_*` block is documented + add a one-liner pointer to `shared/internal/r2-setup.md`.
- `apps/web/.dev.vars.example` and `apps/server/.dev.vars.example` — add a comment-block noting that R2 creds **do NOT live here**; they live in Trigger.dev's dashboard. Prevents the next engineer from misplacing them.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change | **Migration off legacy buckets.** If the legacy `baseout-backup-engine` repo's R2 buckets contain real customer data, a one-time copy / re-key into the new buckets needs its own change. Out of scope here because (a) the buckets may already be empty post-`system-r2-park`, and (b) this change's job is to enable new writes, not migrate old ones. |
| Future change | **R2 multipart upload.** Single-PUT is fine for V1 CSVs (well within 5 GB per object) and current attachment sizes. A future `workflows-r2-multipart` opens this if Airtable attachments grow past the single-PUT ceiling. |
| Future change | **Bucket-level retention policies.** Per-tier retention is owned by `server-retention-and-cleanup`; this change does NOT configure R2 lifecycle rules. |
| Future change | **Cost alerts / Cloudflare billing automation.** §7 of the new runbook flags where to add them; the actual alert wiring is its own change. |
| `system-r2-stance-archive` (decision already archived) | The "should R2 use a Worker binding" debate. Settled by `system-r2-revive`. |

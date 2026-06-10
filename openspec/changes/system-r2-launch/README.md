# system-r2-launch

Operational rollout plan that takes Cloudflare R2 from "code complete" to "actually serves customer backups" — the final piece needed to deliver [PRD §7.2](../../../shared/Baseout_PRD.md) (R2 listed as "✅ V1 (new — internal managed storage)") and [Features §4 / §7](../../../shared/Baseout_Features.md) (R2 = managed default, all tiers, no egress fees).

This change is **infrastructure + verification + documentation** — no application code is written. The application code already exists:

- [`workflows-r2-writer`](../workflows-r2-writer/proposal.md) — R2 `StorageWriter` (S3-API via `aws4fetch`), factory dispatch, cred plumbing. ✅ shipped.
- [`workflows-attachments`](../workflows-attachments/proposal.md) — `writeBlob` interface method R2 uses for attachments. ✅ shipped.
- [`server-attachments`](../server-attachments/proposal.md) — engine `/attachments/lookup` + `/record` routes. ✅ shipped.
- [`system-r2-revive`](../system-r2-revive/proposal.md) — the architecture-decision record that established Node-runner + S3-API as the path. ✅ shipped.

What's missing is the **runtime configuration** the code expects — buckets, API tokens, and env-var wiring per environment — plus an end-to-end smoke that confirms CSV writes, attachment writes, and dedup all work against a real R2 bucket. This change closes that gap, and writes the runbook that captures how to do it again for staging / prod.

See [proposal.md](./proposal.md) for the rationale and scope, [design.md](./design.md) for the per-environment provisioning + verification protocol, and [tasks.md](./tasks.md) for the phased checklist.

---

## Suggested PR description

When opening the PR that lands this change (or the post-rollout PR that closes Phase 7), pull from this block:

```markdown
## Summary

- Ships [`shared/internal/r2-setup.md`](shared/internal/r2-setup.md) — the per-env source-of-truth for managed Cloudflare R2 (buckets, S3-API tokens, env-var locations, verification protocol, failure modes). Mirrors the role [`shared/internal/oauth-setup.md`](shared/internal/oauth-setup.md) plays for BYOS providers.
- Codifies the "consult R2 runbook first" rule in [`CLAUDE.md`](CLAUDE.md) §3.7 alongside the existing OAuth rule.
- Carries explicit "R2 creds are NOT stored here" comment blocks in both `apps/web/.dev.vars.example` and `apps/server/.dev.vars.example` so future engineers don't misplace them.
- Cross-references the runbook from `apps/workflows/.env.example` (the canonical local-dev location).
- No application code changes — the R2 writer (`workflows-r2-writer`), attachment downloader (`workflows-attachments`), and engine dedup routes (`server-attachments`) all shipped earlier; this change is the operational rollout layer.

## Why

PRD §7.2 lists Cloudflare R2 as `✅ V1 (new — internal managed storage)`. Features §4 makes R2 (Managed) available to every tier. The code is finished but no buckets, tokens, or env vars exist for the current monorepo's envs — so every Space configured for `r2_managed` trips the `missing_r2_creds` visible-failure path. This PR + the dashboard work it documents close that gap.

## Reviewer checklist

Mirror [`shared/internal/r2-setup.md`](shared/internal/r2-setup.md) §3 (Per-env provisioning status) before approving:

- [ ] Does the PR add or change a row in §3? If yes, is the corresponding Trigger.dev env-var actually set? (Spot-check at least one.)
- [ ] If the PR touches `R2Writer`, `getR2Creds`, or the `r2_managed` dispatch in `resolveStorageWriter`, does it update §6 (Failure modes) if a new error shape becomes possible?
- [ ] If the PR introduces a new env (e.g. preview-per-PR), does it add a §3.N subsection AND a §1 row AND a §4 gap-checklist entry?
- [ ] No `R2_*` keys added to any `.dev.vars` or `.dev.vars.example` (Workers don't reach R2 — only the Trigger.dev Node runner does).
- [ ] `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` green (no regression in the writer or its tests).
- [ ] `astro check` green in `apps/web` (no regression from the StoragePicker env-gate landed in [`feat(web): expose local_fs option …`](https://github.com/BaseOut/baseout/commit/d0ac323)).

## Test plan

- [ ] Phase 3 §5.7 smoke-run log shows all 5 dev rows green (run IDs captured).
- [ ] Re-running the same backup exercises dedup (Step 4): `attachments_processed = 0` in the second run.
- [ ] `aws s3 ls` against the dev bucket shows the expected `<orgSlug>/<spaceName>/<baseName>/...` prefix structure.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Follow-ups when launched (Phase 7.2 — open issues for these)

When prod rollout completes (Phase 5 §5.7 all green), file four follow-up issues for the deferred items in [proposal.md §"Out of Scope"](./proposal.md). Draft titles + bodies:

### `system-r2-multipart` — R2 multipart upload for large attachments

> **Why:** Single-PUT uploads in [`R2Writer.writeBlob`](../../../apps/workflows/trigger/tasks/_lib/storage-writers/r2.ts) are capped at R2's 5 GB per-object ceiling. If an Airtable customer attaches a large media file (video, design source, etc.) the backup will fail at that attachment. **When to file:** the first time a backup fails with a 5xx on a single attachment > some-multiple-of-100MB. **Scope:** add `createMultipartUpload` / `uploadPart` / `completeMultipartUpload` to `R2Writer` for blobs above a threshold (suggested 100 MB based on memory budget on the Trigger.dev Node runner).

### `system-r2-retention-r2-side` — Bucket-level lifecycle rules

> **Why:** Per-tier retention is owned by [`server-retention-and-cleanup`](../server-retention-and-cleanup/proposal.md), which deletes by writing through the storage destination. Adding R2-side lifecycle rules (auto-expire objects older than X) gives belt-and-suspenders coverage if the engine ever fails to clean up. **When to file:** after `server-retention-and-cleanup` is live and we have ≥30 days of production R2 data. **Scope:** Cloudflare R2 → bucket → Object Lifecycle → rules matching per-tier retention windows.

### `system-r2-cost-alerts` — Cost monitoring thresholds

> **Why:** [`shared/internal/r2-setup.md`](../../../shared/internal/r2-setup.md) §7 has a TODO placeholder for alert thresholds. Without alerts, a runaway backup loop or a customer with unexpectedly large bases inflates the R2 bill before anyone notices. **When to file:** Phase 5 verification complete. **Scope:** define daily storage-growth, Class A ops/hour, and per-Space-storage thresholds; wire Cloudflare alerts → email or Slack.

### `system-r2-legacy-bucket-migration` — Move historical data (if any)

> **Why:** The legacy `baseout-backup-engine` referenced buckets in its `wrangler.jsonc` (`baseout-backups-dev` etc.). If those buckets still hold real customer data, we need a one-time copy-and-re-key into the new `system-r2-launch` buckets. **When to file:** after auditing the legacy buckets in the Cloudflare dashboard. **Scope:** if empty, no-op. If populated, write a one-shot migration script.

Filing mechanism is **whichever issue tracker the team uses** (GitHub Issues for `BaseOut/baseout` if that's the choice). Per [CLAUDE.md §8](../../../CLAUDE.md), don't auto-file — get user approval first.

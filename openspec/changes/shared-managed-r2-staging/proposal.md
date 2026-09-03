# shared-managed-r2-staging

> **Depends on**: [`system-r2-revive`](../system-r2-revive/proposal.md) (S3-on-Node write path, shipped), [`workflows-r2-writer`](../workflows-r2-writer/proposal.md) (`R2Writer`, shipped). **Executes**: [`system-r2-launch`](../system-r2-launch/proposal.md) Phase 4 (staging), re-based onto the current Cloudflare env model. **Does NOT implement**: [`system-r2-bucket-topology`](../system-r2-bucket-topology/proposal.md) (per-account buckets — still a proposal; the live model remains one shared bucket per env).

## Why

Managed R2 is a launch-critical Storage Destination: **Cloudflare R2 (Managed)** is available on every plan (Features §7 destination matrix), managed snapshots count toward the per-tier **R2 File Storage** caps (Features §3), and PRD §7.2 defines the streaming write path. Three things currently stand between that spec and a working staging environment:

1. **The setup wizard writes an invalid storage type.** In `apps/web/src/views/IntegrationsSetupWizard.astro`, the destination option injected after saving a managed destination carried the radio value `dest-new-file` instead of a real storage type. That value feeds `chosenStorageType` at the Review step, so the final PATCH fails with `422 unsupported_storage_type` — a customer who picks Managed R2 in the wizard cannot complete setup. (Fix drafted on branch `web-wizard-managed-r2-fix`, uncommitted.)

2. **The runbook has drifted from the actual Cloudflare setup.** `shared/internal/r2-setup.md` still describes buckets `baseout-backups-{dev,staging,prod}` and per-env Workers (`baseout-server-staging`), and its §3 provisioning tables are all-❌ while its own header claims the dev bucket is LIVE. The committed 3-env `apps/server/wrangler.jsonc` (Sep-1 model) binds `BACKUPS_R2` to **`baseout-dev` / `baseout-staging` / `baseout-live`** — different names, different env layout. Anyone following the runbook today provisions the wrong buckets.

3. **Staging has never run the verification protocol.** `system-r2-launch` Phase 4 (staging provisioning + verification) is entirely unchecked, and the Trigger.dev **Staging** environment's four `R2_*` vars are unconfirmed. Until the §5 protocol (CSV landing, attachments + dedup, re-run dedup, deletePrefix) runs green against staging, we cannot claim managed backups work there.

## What Changes

- **`apps/web`** — Wizard fix: the injected managed-destination radio carries the real storage type (`r2_managed`, or `local_fs` for the dev-only local option) so the Review-step PATCH succeeds. Regression coverage for the value mapping.
- **`shared/internal/r2-setup.md`** — Reconcile to reality: bucket names from the committed `wrangler.jsonc` (`baseout-{dev,staging,live}`), the one-Worker-with-`--env` deploy model, resolve the header-vs-§3.1 contradiction, and re-baseline the §3 provisioning tables against what actually exists in the Cloudflare account (verified, not assumed).
- **Staging provisioning (dashboard work, split by ownership)** — Confirm bucket `baseout-staging` exists; generate a bucket-scoped `Object Read & Write` API token for it (account-level Cloudflare access is Dan's — file a precise ask where required); set the four `R2_*` vars in the Trigger.dev **Staging** environment. No `R2_*` values ever enter any `.dev.vars` (runbook §2.4).
- **Staging verification** — Run r2-setup.md §5 Steps 1–5 against staging end-to-end: wizard → Managed R2 destination → manual backup → CSVs + attachments in `baseout-staging` → dedup on re-run → deletePrefix. Log every step in the §5.7 smoke-run log; tick off `system-r2-launch` Phase 4 tasks as they complete.

## Out of Scope

| Deferred to | Item |
|---|---|
| `system-r2-bucket-topology` | Per-account buckets, key-layout change, read-path off the static binding. |
| `system-r2-launch` Phase 5+ | Production provisioning + verification (gated on staging green, and on Dan's prod-account ownership). |
| `shared-entitlements` | The R2 File Storage meter and tier-cap enforcement. |
| Future change | Dev-env re-verification under the new bucket names (staging is the ask; dev gets re-baselined in the runbook but not re-smoked here unless staging verification forces it). |

## Capabilities

- `managed-r2-backups`: A Space configured with the Managed R2 Storage Destination completes wizard setup and produces verified staging backups (CSVs, attachments, dedup, cleanup) in the env's shared R2 bucket.

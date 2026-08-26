# shared-worker-previews

> **Continuation of**: the 2026-08-24 Cloudflare pivot (see `project_aug24_dan_sync_cloudflare_pivot` auto-memory + `shared/internal/cloudflare-env-separation.md`) and the 2026-08-25 Dan/Autumn call. **Source docs**: the Worker Previews closed-beta documentation Dan shared (`https://worker-previews-docs-2.preview.developers.cloudflare.com/workers/previews/` + `/configuration/`, `/resources/`, `/custom-domains/`) — these supersede the stale GA docs for this account. **Out of scope here**: Workers Builds dashboard settings (branch pinning, build-time `DATABASE_URL`) — already done by Dan per the Aug-25 call; custom preview domains — already attached in the dashboard (`console.baseout.dev`, `admin.baseout.dev`), deliberately NOT declared as wrangler routes.

## Why

The account's env model is now **one Worker per app with built-in production + previews** (`baseout-console`, `baseout-server`, `baseout-admin`); staging-as-separate-Worker is dead (`baseout-staging`, `baseout-server-staging` were never created). Enabling preview builds failed on 2026-08-20 with *"missing required secret value / no existing preview base config binding to inherit from"*. The beta docs give the fixes: every binding a preview uses must be **restated in a `previews` config block** (no inheritance from production except compat/assets/placement), and preview secrets must be entered via `wrangler preview secret` (they never copy).

The 2026-08-25 call settled the mechanism: **bindings come from the wrangler file, not the dashboard UI** (a pushed config overrides dashboard-set values for the same key; secrets survive). The dashboard "Import from production" button is a known beta bug — Dan's partial import left `baseout-console`'s preview base config nearly complete but **missing the HYPERDRIVE binding entirely** (the exact "preview hyperdrive on baseout console" task), `baseout-server`'s with secrets only (no bindings at all), and `baseout-admin`'s empty.

Compounding this: the Aug-24 cutover edits (live Hyperdrive/R2/KV ids, previews blocks, `env.production` blocks) were made in the **gitignored rendered** `wrangler.jsonc` files, but `scripts/launch.mjs` re-renders those from the committed `wrangler.jsonc.example` templates on every dev/build run — the next `pnpm dev` in apps/server or apps/admin silently reverts the cutover config. Promoting those edits into the templates is load-bearing.

## What Changes

Config + scripts + runbooks across `apps/web`, `apps/server`, `apps/admin` (hence `shared-`). No runtime code changes.

### 1. Promote Aug-24 rendered edits into committed templates (server, admin)
- `apps/server/wrangler.jsonc.example` ← rendered state: top-level = production script `baseout-server` (live Hyperdrive `62a17f…`, `baseout-live` R2, top-level crons, `PUBLIC_APP_URL=https://console.baseout.com`), `previews` block (dev Hyperdrive `ba2652…`, `baseout-backups-dev` R2, DOs, `console.baseout.dev`), with `{{DATABASE_URL}}` placeholders restored. Drop the `env.staging` stub (worker never existed; previews replace staging).
- `apps/admin/wrangler.jsonc.example` ← rendered state: `previews` block + `env.production` (`baseout-admin`, live Hyperdrive, `baseout-live-admin` KV, `images` binding, `WEB_APP_URL=https://console.baseout.com`).

### 2. apps/web wrangler template: real production + previews
- `env.production`: name **`baseout-console`** (not the stale `baseout`), mirroring the deployed version's bindings verbatim (verified via `wrangler versions view`, 2026-08-25): live Hyperdrive `62a17f7db4c6402ca5cde230360c1e5b`, SESSION KV `baseout-live` (`962f82f2…`), `BACKUP_ENGINE → baseout-server`, prod vars (`PUBLIC_AUTH_BASE_URL=https://console.baseout.com`, `ADMIN_APP_URL=https://admin.baseout.com`), no `E2E_TEST_MODE`. Mirroring the dashboard exactly is the point — a config-driven deploy must not clobber what Dan set.
- `env.production.previews`: the preview base config, mirroring the dashboard's partial import **plus the missing HYPERDRIVE** (dev id `ba2652…`): dev SESSION KV, `BACKUP_ENGINE → baseout-server`, `EMAIL`, preview vars (`PUBLIC_AUTH_BASE_URL=https://console.baseout.dev`, `ADMIN_APP_URL=https://admin.baseout.dev`, `E2E_TEST_MODE=true`).
- Drop `env.staging`. Top-level (dev worker `baseout-dev`, the local-dev loop) is untouched.

### 3. Preview settings sync scripts
- Per-app `preview:sync` npm script: render config via `launch.mjs render-config`, then `wrangler preview settings update` (`-e production` for web; top-level for server; `--worker-name baseout-admin` for admin). Deep-merges the previews block into the Worker's preview defaults; existing preview secrets survive.

### 4. Preview secrets
- `baseout-console` + `baseout-server` preview secrets already exist (Dan re-entered them). Gap: `baseout-admin` previews have none — mint a fresh `ADMIN_HANDOFF_SECRET` and set it on **both** `baseout-admin` and `baseout-console` previews (must be byte-identical for the handoff to work; console's current preview value is unverifiable, so both sides are set together).
- Commands staged for human approval, never run unattended (they mutate deployed state).

### 5. Runbooks (same change, per CLAUDE.md §3.7)
- `shared/internal/cloudflare-env-separation.md`: the beta-docs URLs, the previews-block model, the wrangler-overrides-dashboard rule, the sync scripts, the settled three-env answer (Cloudflare = production + previews; local dev = `wrangler dev` only).
- `shared/internal/oauth-setup.md`: §3 gap rows for the preview origins (`console.baseout.dev` callbacks not yet registered with Airtable/Google/Box/Dropbox/Microsoft) + §4 checklist entries.

## Impact

- Affected code: `apps/{web,server,admin}/wrangler.jsonc.example`, `apps/{web,server,admin}/package.json` (one script each), runbooks under `shared/internal/`.
- Security review points (§3.3): no new secrets introduced (one existing secret re-minted for previews); no new auth paths; preview URLs are **public by default** — Cloudflare Access in front of previews is an open decision for Dan (flagged in design.md, not implemented here).
- ⚠ Known gap (documented, not solved): service bindings from previews resolve to **production** deployments (beta docs, `/resources/`), so preview web/admin drive the **live** `baseout-server` (live DB) while their own HYPERDRIVE points at the dev DB. Cross-DB mismatch for engine flows in previews — raised for the Aug-26 regroup with Dan.

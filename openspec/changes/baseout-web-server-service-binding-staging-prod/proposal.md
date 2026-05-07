## Why

The dev half of the `apps/web` ↔ `apps/server` service binding is live as of [openspec/changes/baseout-web-server-service-binding/](../baseout-web-server-service-binding/). That change deliberately scoped the new `services` block in `apps/web/wrangler.jsonc.example` to dev only, because:

- `baseout-server-staging` (Cloudflare Worker) does not yet exist as a deployed target.
- `baseout-server` (production) does not yet exist as a deployed target.
- Declaring a `services` block whose `service` field references a non-existent Worker fails at deploy time. Adding both staging + production declarations now would block `wrangler deploy --env staging` / `--env production` for `apps/web`.

This change finishes the wiring once both backend deploy targets exist.

## What Changes

- **Activate the staging service binding** in [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) under `env.staging`, pointing at `baseout-server-staging`.
- **Activate the production service binding** in [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) under `env.production`, pointing at `baseout-server`.
- **Redeclare the engine's `env.staging` and `env.production` blocks** in [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example). Today these blocks only carry `name`. Wrangler does not inherit non-inheritable keys (`hyperdrive`, `durable_objects`, `kv_namespaces`, `send_email`, `vars`, `services`) into env blocks, so each must explicitly redeclare:
  - `hyperdrive` binding (with the staging / production Hyperdrive ID once provisioned)
  - `durable_objects` bindings (`CONNECTION_DO`, `SPACE_DO`)
- **Set the four required Cloudflare Secrets per env on apps/server** (`INTERNAL_TOKEN`, `BASEOUT_ENCRYPTION_KEY`, `DATABASE_URL`, plus `TRIGGER_SECRET_KEY` / `TRIGGER_PROJECT_REF` once Phase 2 cron work lands). `INTERNAL_TOKEN` MUST byte-equal apps/web's `BACKUP_ENGINE_INTERNAL_TOKEN` for the same env.
- **Provision the staging + production Hyperdrives** if not already done (per [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md) §1) and swap the placeholder IDs in `apps/server/wrangler.jsonc.example` for the real ones.
- **Deploy in order:** `apps/server` first to that env, then `apps/web`. The staging binding can't resolve until `baseout-server-staging` exists; same for production.
- **Clean up the legacy `BACKUP_ENGINE_URL` Cloudflare Secret** (per the prior change's task §10.2): `wrangler secret delete BACKUP_ENGINE_URL --env <env>` for any env where it was set. Optional but tidy.

## Out of Scope

- **Multi-worker local dev** (apps/web binding pointing at a sibling local wrangler-dev instance). Out of scope per the prior change; reopen if redeploy friction proves painful.
- **WorkerEntrypoint typed RPC** for the binding. Same scope-deferral rationale as the prior change: no second consumer yet.
- **Service bindings for `apps/api` / `apps/admin` / `apps/hooks`.** None of those Workers exist deployed; each will need its own follow-up.
- **Schema or wire-format changes.** Identical surface to the prior dev change — `POST /api/internal/connections/:id/whoami` with `x-internal-token` header.

## Capabilities

### Modified Capability

- `web-engine-service-binding` — extends the dev-only binding from the prior change to staging and production.

## Impact

- **Pre-req**: `apps/server` must be deployed in the target env before the corresponding `apps/web` deploy.
- **`apps/web` config**: two new `services` blocks (one per env). No code change.
- **`apps/server` config**: redeclares hyperdrive + durable_objects in env.staging and env.production blocks. No code change.
- **Secrets**: `INTERNAL_TOKEN`, `BASEOUT_ENCRYPTION_KEY`, `DATABASE_URL` set on `apps/server` per env via `wrangler secret put`. `BACKUP_ENGINE_INTERNAL_TOKEN` already on `apps/web` per env (legacy; same value as engine's `INTERNAL_TOKEN`).
- **Cleanup**: deletes legacy `BACKUP_ENGINE_URL` secret on `apps/web` per env if present.

## Reversibility

Roll-forward only, but the rollback is mechanical: revert the `services` blocks in `apps/web/wrangler.jsonc.example` for staging+prod; redeploy `apps/web`. The deployed `baseout-server-staging` / `baseout-server` Workers can be left in place or `wrangler delete`d separately.

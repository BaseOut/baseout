## Why

The Test connection probe on `/integrations` (the `POST /api/connections/airtable/test` route) returns 502 today, with the new self-diagnosing UI surfacing `engine_error (HTTP 403)`. The 403 is **not** a bug in the route, the engine, or the encryption: it's an architecture mismatch in the dev wiring.

Diagnosed on 2026-05-07:

- `apps/web` runs `wrangler dev --remote` (per [apps/web/package.json](../../../apps/web/package.json) — required for real R2 / KV / Hyperdrive / `EMAIL` send_email bindings during dev).
- `--remote` runs the Worker code on Cloudflare's actual edge infrastructure, not on the dev machine.
- Today's [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) makes a plain HTTP `fetch()` to `BACKUP_ENGINE_URL` (`http://localhost:4341` in dev).
- Cloudflare's edge refuses outbound `fetch()` from a Worker to RFC1918 / loopback addresses with a 403 Forbidden response. The fetch returns; the body has no recognizable engine error code; the engine client maps it to `engine_error`; the route returns 502 with `upstream_status: 403`.
- Even with `apps/server` perfectly healthy, this transport will never work as long as `apps/web` runs `--remote`. Forcing `apps/web` to local-only dev would lose the bindings the team specifically chose `--remote` to keep.

Cloudflare **service bindings** (`env.BACKUP_ENGINE.fetch(req)`) route Worker-to-Worker calls through Cloudflare's internal network instead of the public internet. They work identically in:

- `wrangler dev --remote` (binding resolves to the deployed sibling Worker).
- `wrangler dev` local with multi-worker mode (binding resolves to a sibling `wrangler dev` instance).
- Deployed dev / staging / production (binding resolves within the same account).

This change is also the Cloudflare-native expression of the boundary [CLAUDE.md §5.2](../../../CLAUDE.md) already declares: "`/api/internal/*` is gated by the `x-internal-token` header. Frontend calls these to enqueue work. No other public surface." A service binding makes `apps/server`'s `/api/internal/*` literally non-public — never exposed on a workers.dev URL, never reachable except from the bound Worker. The `INTERNAL_TOKEN` gate stays as defense-in-depth (a leaked apps/web binding shouldn't grant trivial cross-Worker access).

## What Changes

- **Declare the service binding** in [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) under each env block (top-level dev + `env.staging` + `env.production`). Wrangler does not inherit `services` across env blocks, so each must be redeclared. The dev block uses environment `dev`, staging uses `staging`, production uses `production`.
- **Refactor [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts)** so `createBackupEngine` takes a `Fetcher` (the type of a service-binding handle) instead of `url + fetchImpl`. The wire format (POST `/api/internal/connections/:id/whoami` with `x-internal-token: <token>` header + JSON body) is unchanged — only the transport handle changes.
- **Update [apps/web/src/pages/api/connections/airtable/test.ts](../../../apps/web/src/pages/api/connections/airtable/test.ts)** to pull `env.BACKUP_ENGINE` (the binding) and `env.BACKUP_ENGINE_INTERNAL_TOKEN` (the defense-in-depth secret), pass both to `createBackupEngine`. Drop the `BACKUP_ENGINE_URL` read.
- **Update [apps/web/src/env.d.ts](../../../apps/web/src/env.d.ts)** `ProvidedEnv` to declare `BACKUP_ENGINE: Fetcher` and remove `BACKUP_ENGINE_URL`. `BACKUP_ENGINE_INTERNAL_TOKEN` stays.
- **Update [apps/web/.dev.vars.example](../../../apps/web/.dev.vars.example)** — remove `BACKUP_ENGINE_URL`, keep `BACKUP_ENGINE_INTERNAL_TOKEN`. Add a comment block explaining the deploy precondition (`baseout-server-dev` must exist).
- **Add a dev env to [apps/server/wrangler.jsonc](../../../apps/server/wrangler.jsonc)** so `apps/web`'s `dev` env service binding has a real Worker to point at: `env.dev` named `baseout-server-dev`. This mirrors how `env.staging`/`env.production` already exist on the same file.
- **Tests:** [apps/web/src/lib/backup-engine.test.ts](../../../apps/web/src/lib/backup-engine.test.ts) — replace `fetchImpl` mock with a `Fetcher` mock (a `{ fetch(req): Response }` object). Existing 10 tests stay; only the test fixture shape changes. The new [apps/web/src/pages/api/connections/airtable/_engine-status.ts](../../../apps/web/src/pages/api/connections/airtable/_engine-status.ts) helper and its [test.spec.ts](../../../apps/web/src/pages/api/connections/airtable/test.spec.ts) need no changes.
- **Docs:** [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md) gains a "Local dev: deploying baseout-server-dev" subsection. The dev workflow change is small but real: a one-time `pnpm --filter @baseout/server deploy:dev` before iterating on the Test-connection path, and a redeploy whenever apps/server code changes.

## Out of Scope

- **Removing `INTERNAL_TOKEN` entirely.** Service bindings provide network-level isolation, but token gating remains as defense-in-depth. A leaked or compromised apps/web Worker shouldn't trivially read the master DB through apps/server. Both controls stack.
- **Multi-worker local dev** (running `wrangler dev` on both apps with no `--remote`, with apps/web's binding pointing at a sibling local wrangler-dev instance). This is supported by wrangler v4's `--config` flag, but it's a fallback path — the primary dev flow this change establishes is "deploy `baseout-server-dev`, iterate via re-deploy." Multi-worker local dev is a separate change once we know whether the redeploy cost is too high.
- **Service bindings for `apps/api` / `apps/admin` / `apps/hooks`.** Those Workers don't yet exist as deployed targets. Each will need its own binding once it does. Out of scope here.
- **Production deploy of `apps/server`.** The `env.production` declaration in apps/server's wrangler.jsonc already exists; this change does not touch the prod deploy story. Production deploy is gated on the prerequisites called out in [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md) (Hyperdrive prod ID, KV prod ID, secrets) — separate ops change.
- **Replacing the URL/token-based wire format with native bindings (e.g. exposing typed methods via `WorkerEntrypoint`).** Service bindings allow a richer typed RPC surface (`apps/server` could export class methods callable via the binding), but this change keeps the existing HTTP-shaped wire format so the engine endpoints remain testable in isolation and the engine-side changes are zero. A future change can refactor to `WorkerEntrypoint` once a second route consumes the binding.
- **Swapping out `BACKUP_ENGINE_URL` callers in `apps/api` / `apps/hooks` / `apps/admin`.** None of those exist yet; the only consumer of the engine client today is apps/web's test route.

## Capabilities

### New Capability

- `web-engine-service-binding` — a Cloudflare Worker service binding (`env.BACKUP_ENGINE`) that gives `apps/web` a non-public, type-safe `Fetcher` handle to `apps/server`. Wire format (JSON POST + `x-internal-token`) and engine-side surface (`/api/internal/*`) are unchanged.

### Modified Capability

- `web-engine-client` (the `createBackupEngine` factory in `apps/web`) — option signature changes from `{ url, internalToken, fetchImpl? }` to `{ binding, internalToken }`. The returned client's surface (`whoami(connectionId)`) and result types (`EngineWhoamiResult`) are unchanged. All consumers of the client (today: only the test route) move from URL-resolution to binding-injection in lockstep.

## Impact

- **`apps/web` runtime:** no change in behavior on success or error paths. Same JSON wire format, same `x-internal-token` header, same response handling. The fetch transport changes from public-network HTTP to Cloudflare's internal Worker-to-Worker network.
- **`apps/web` config:** `BACKUP_ENGINE_URL` env var is removed (was previously a `wrangler secret`). `BACKUP_ENGINE_INTERNAL_TOKEN` stays. New `services` block in wrangler.jsonc per env.
- **`apps/server`:** zero code changes. The middleware token gate at [apps/server/src/middleware.ts](../../../apps/server/src/middleware.ts) and the whoami handler at [apps/server/src/pages/api/internal/connections/whoami.ts](../../../apps/server/src/pages/api/internal/connections/whoami.ts) work identically whether the request arrives via public HTTP or service binding — Cloudflare presents the request to the bound Worker exactly as a `fetch` event, with headers preserved.
- **`apps/server` config:** add `env.dev` block to `apps/server/wrangler.jsonc` (Worker name `baseout-server-dev`, dev Hyperdrive id, dev secrets). This provides a deploy target that `apps/web`'s dev service binding resolves to.
- **Dev workflow:** **changes.** Today: start `apps/server` locally on `:4341`, start `apps/web` with `--remote`, hit `/integrations`. After this change: deploy `apps/server` to `baseout-server-dev.openside.workers.dev` (one command — `pnpm --filter @baseout/server deploy:dev`), then iterate. Engine-side changes require redeploy. This is documented in [shared/internal/ops-setup.md](../../../shared/internal/ops-setup.md). The trade-off is real but the redeploy is fast (~10s) and only kicks in for engine-side iteration, which is currently rare.
- **Production deploy:** unchanged. Both apps already deploy via `wrangler deploy`. The new `services` binding in `apps/web`'s production env requires `apps/server` to be deployed *first* in prod. This is a one-time ordering — once both are deployed, future deploys of either can proceed independently. Documented as a prerequisite.
- **Secrets:** `BACKUP_ENGINE_URL` is dropped from the secrets list in `apps/web` (every env). `BACKUP_ENGINE_INTERNAL_TOKEN` (web) and `INTERNAL_TOKEN` (server) stay — both must remain byte-equal across the pair.
- **Tests:** `apps/web/src/lib/backup-engine.test.ts` rewires its mock from `fetchImpl` to a `Fetcher`-shaped stub. The 10 existing tests stay green. The 10 tests in `apps/web/src/pages/api/connections/airtable/test.spec.ts` (covering the engine-code → HTTP-status mapping) need no changes — they don't touch the transport.
- **Observability:** unchanged. Service bindings show up in Cloudflare's Workers Trace as a single inbound request to `apps/server` from `apps/web`'s named binding — slightly cleaner attribution than today's anonymous public HTTP hit.

## Reversibility

Roll-forward, not roll-back, but the rollback is mechanical: revert the diff to [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) (restore the URL + fetchImpl signature), revert the `services` block in apps/web's wrangler.jsonc, restore `BACKUP_ENGINE_URL` in env.d.ts and .dev.vars.example. The `apps/server` side has no code changes to undo. The `baseout-server-dev` deployment can be left in place or torn down via `wrangler delete --name baseout-server-dev` — neither affects the rolled-back path.

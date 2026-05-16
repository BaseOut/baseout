# shared-server-service-binding

Replaces `apps/web` → `apps/server` HTTP+token transport with a Cloudflare Worker **service binding**. Today the web app calls the engine at `BACKUP_ENGINE_URL` over the public network, gated by `x-internal-token`. This works in deployed Workers but is broken in `wrangler dev --remote`: Cloudflare's edge refuses outbound `fetch()` to RFC1918 / loopback addresses (returns 403), so the engine probe at `POST /api/connections/airtable/test` always fails when `BACKUP_ENGINE_URL=http://localhost:4341`.

A service binding (`env.BACKUP_ENGINE.fetch(...)`) routes calls through Cloudflare's internal network instead of the public internet. It works identically in `wrangler dev --remote`, deployed dev/staging/production, and resolves the architecture mismatch surfaced today on `/integrations`. The wire format (JSON POST + `x-internal-token` header) is unchanged — `INTERNAL_TOKEN` stays as defense-in-depth.

The change touches both apps but is small in each: `apps/web` swaps the engine client to take a `Fetcher` instead of a URL, declares a service binding in `wrangler.jsonc.example`, and drops `BACKUP_ENGINE_URL` from the env. `apps/server` gains no code changes — its middleware still gates `/api/internal/*` on `x-internal-token`. Dev workflow grows a small precondition: a `server-dev` Worker must be deployed to the same Cloudflare account so apps/web's binding can resolve to it.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.

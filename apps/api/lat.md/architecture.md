# Architecture

`@baseout/api` is the public versioned inbound API at `api.baseout.com`. It authenticates customer API keys, validates payloads, and forwards work into `apps/server` over the HMAC service-token boundary.

Currently scaffolded as [src/index.ts](../src/index.ts) only. Phase 2 adds the v1 surface.

## Scope

What this app does and doesn't do. The split exists so customer-facing API contracts are versioned and stable, separate from internal engine evolution.

- For: stable, versioned customer ingest API. Authenticated by per-customer API keys.
- Not for: customer dashboards (that's `apps/web`), Airtable webhook ingest (that's `apps/hooks`), read-only SQL access (that's `apps/sql`).

## Request Flow

The end-to-end path for a typical inbound API call:

1. Client calls `https://api.baseout.com/v1/<endpoint>` with an `Authorization: Bearer <api-key>` header.
2. `apps/api` looks up the API key by hash (`api_tokens.token_hash`); 401 on miss.
3. `apps/api` validates the JSON payload via Zod.
4. `apps/api` forwards the validated, normalised payload to `apps/server`'s `/api/internal/*` with an HMAC-signed service token from `@baseout/shared`.
5. `apps/api` returns the engine's response shape (or a translated error) to the client.

## Deployment

Cloudflare Workers via Wrangler. Worker name: `baseout-api`. Configuration in [wrangler.jsonc](../wrangler.jsonc); environments are `production` and `staging`. DNS pointed at `api.baseout.com`.

## Where to Look

Pointers to related rules and apps.

- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- Versioning policy: [[versioning]]
- Service auth (HMAC + API key hashing): [[service-auth]]

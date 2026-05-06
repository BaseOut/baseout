# Service Auth

`apps/hooks` only signs **outbound** requests — there's no inbound API key model here. Inbound trust comes from Airtable's HMAC, not from per-customer credentials.

The outbound HMAC service token is the same shape used by `apps/api` and `apps/web`, minted via `@baseout/shared`.

## Outbound HMAC

When forwarding to `apps/server`, `apps/hooks` mints an HMAC service token per request. Headers:

| Header | Value |
|---|---|
| `x-baseout-signature` | `hmac_sha256(secret, "<method>\n<path>\n<body-hash>\n<timestamp>")` |
| `x-baseout-timestamp` | Unix seconds at signing |
| `x-baseout-app` | `hooks` (used for audit only) |

`apps/server` verifies, rejects requests older than 60 seconds, and enqueues the engine work. Per [root cross-app-comm](../../../lat.md/cross-app-comm.md), this is the same scheme used by `apps/api`.

## No Inbound Customer API Keys

Customers don't authenticate to `apps/hooks` — Airtable does, by signing the webhook body with the per-webhook secret we registered with Airtable. That's the boundary.

If a non-Airtable inbound channel ever needs `apps/hooks`-style ingress, it's a new app, not a new endpoint here.

## Secret Rotation

The HMAC secret shared with `apps/server` lives in Cloudflare Secrets and must be rotated in lockstep across both Worker namespaces.

Airtable webhook secrets are per-customer and rotated by re-registering the Airtable webhook (a customer-initiated flow surfaced in `apps/web` settings).

## Where to Look

Pointers to related rules and helpers.

- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- Root security model: [root security-model](../../../lat.md/security-model.md)
- HMAC helpers: `packages/shared` (per [root monorepo-layout](../../../lat.md/monorepo-layout.md))

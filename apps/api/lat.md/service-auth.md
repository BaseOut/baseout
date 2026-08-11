# Service Auth

Two distinct auth boundaries: **inbound** customer API keys (per-customer, hashed in DB) and **outbound** HMAC service tokens (per-Worker, secret) when forwarding to `apps/server`.

Conflating these is a security bug. Customer API keys are revocable per-customer; HMAC service tokens are infrastructure-level.

## Inbound: Customer API Keys

API keys are issued in `apps/web`'s settings UI. The DB stores **only the hash** in `api_tokens.token_hash` per [shared/Baseout_PRD.md §21.3](../../../shared/Baseout_PRD.md). Plaintext tokens are shown to the user **once** at creation.

Per request:

1. Read `Authorization: Bearer <token>`.
2. Hash with the same algorithm used at issuance.
3. Look up by hash in `api_tokens`. 401 on miss.
4. Check token's `is_revoked` and `expires_at`. 401 if revoked or expired.
5. Resolve the Organization + scopes attached to the token; populate request locals.

Per [root security-model](../../../lat.md/security-model.md), tokens are scoped to the narrowest viable set — never grant Org-wide write when a single Space-scoped read will do.

## Outbound: HMAC Service Token

When forwarding to `apps/server`, `apps/api` mints an HMAC service token per request via `@baseout/shared`. The shape:

```
header: x-baseout-signature
value:  hmac_sha256(secret, "<method>\n<path>\n<body-hash>\n<timestamp>")
header: x-baseout-timestamp: <unix-seconds>
header: x-baseout-app: api
```

`apps/server` verifies the signature, rejects requests older than 60 seconds, and uses `x-baseout-app` for audit only — never for trust decisions.

The HMAC secret lives in Cloudflare Secrets and is shared between `apps/api` and `apps/server`. Rotation requires updating both Worker Secret namespaces in lockstep.

## Where to Look

Pointers to related rules and helpers.

- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- Root security model: [root security-model](../../../lat.md/security-model.md)
- HMAC helpers: `packages/shared` (per [root monorepo-layout](../../../lat.md/monorepo-layout.md))
- API token table: [shared/Baseout_PRD.md §21.3](../../../shared/Baseout_PRD.md)

# Airtable Webhook Flow

The Airtable side of the contract: how Airtable posts payloads, how `apps/hooks` verifies them, and how dedup is enforced.

The webhook secret per customer is stored encrypted in the master DB (per [root security-model](../../../lat.md/security-model.md)) and decrypted at request time.

## Inbound Shape

Airtable's webhook POST body is JSON describing the changed records. Notable fields:

- `webhook` — Airtable webhook ID (matches the URL path segment).
- `timestamp` — Airtable-side delivery time.
- `payloads[]` — One or more change events; each carries the affected `baseId`, `tableId`, and a delta description.

We treat the body as opaque from a domain perspective — `apps/hooks` validates the signature and forwards. The actual interpretation is `apps/server`'s job.

## HMAC Verification

The constant-time verification step that gates every request. A failure is a 401, not a 400 — never disclose whether the webhook ID was valid versus the signature was wrong.

1. Read the `X-Airtable-Content-MAC` header.
2. Look up the webhook secret by webhook ID in the master DB.
3. Compute `hmac_sha256(secret, raw_body)`.
4. Constant-time compare with the header value. 401 on mismatch.

If the webhook ID is unknown (Airtable retrying after we deleted the webhook), 410 Gone with no body — Airtable will eventually stop retrying.

## Deduplication

Airtable can deliver the same webhook twice on retries. `apps/hooks` dedups by `(webhook_id, timestamp, payload_hash)` against a short-lived cache (Cloudflare KV with a 1-hour TTL, or a per-webhook DO).

A duplicate returns 200 with `{ "deduped": true }` — Airtable is happy, `apps/server` doesn't see the same event twice.

## Forwarding

Verified, deduped payloads are forwarded to `apps/server`'s `/api/internal/webhook` with an HMAC service token (see [[service-auth]]). The forward is fire-and-forget from the customer's perspective; engine processing happens in a Trigger.dev task.

`apps/hooks` returns 2xx to Airtable as soon as the forward enqueue completes.

## Where to Look

Pointers to spec and related rules.

- Instant Backup PRD: [shared/Baseout_PRD.md §2.7](../../../shared/Baseout_PRD.md)
- Outbound auth: [[service-auth]]
- Root security model: [root security-model](../../../lat.md/security-model.md)
- Airtable webhook docs: <https://airtable.com/developers/web/api/webhooks-overview>

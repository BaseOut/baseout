# Architecture

`@baseout/hooks` is the public Airtable webhook receiver at `webhooks.baseout.com`. It verifies the inbound HMAC signature from Airtable, deduplicates, and forwards the payload into `apps/server` over the HMAC service-token boundary.

Currently scaffolded as [src/index.ts](../src/index.ts) only. Phase 2 ships the v1 surface (Business+ Instant Backup feature).

## Scope

What this app does and doesn't do. Keeping the verification + forward narrow is the whole point — the engine never trusts an unverified Airtable payload.

- For: Airtable webhook ingress, HMAC verification, dedup, fast forward to `apps/server`.
- Not for: backup execution (that's `apps/server`), customer dashboards (that's `apps/web`), inbound API for non-Airtable sources (that's `apps/api`).

## Request Flow

The hot path on every Airtable webhook delivery:

1. Airtable POSTs to `webhooks.baseout.com/v1/airtable/<webhook-id>`.
2. `apps/hooks` reads the Airtable HMAC signature and verifies against the stored secret for that webhook (master DB lookup).
3. Dedup against the recent-deliveries cache (Cloudflare KV or DO storage).
4. Forward the payload to `apps/server`'s `/api/internal/webhook` with an HMAC service token.
5. Return 2xx to Airtable as fast as possible — Airtable retries on slow responses.

## Latency Budget

Airtable expects webhooks to acknowledge quickly (low single-digit seconds). The Worker should:

- Verify and forward within ~500 ms.
- Use `ctx.waitUntil` for any non-critical follow-up work.
- Never block on `apps/server` doing the actual ingest — that runs in a Trigger.dev task.

## Where to Look

Pointers to related rules and apps.

- Webhook flow: [[airtable-webhook-flow]]
- Outbound auth: [[service-auth]]
- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- Instant Backup spec (Business+): [shared/Baseout_PRD.md §2.7](../../../shared/Baseout_PRD.md)

# Cross-App Communication

How `apps/*` talk to each other and to customer infrastructure. Public surfaces are minimal; everything else is service-to-service authenticated. Source: [openspec/config.yaml](../openspec/config.yaml) "Cross-App Communication" section + [CLAUDE.md](../CLAUDE.md) §2.

## Topology

The data plane fans into `apps/server` from three external entry points (`hooks`, `api`, `web`) and out to customer DBs through `apps/sql`. Each link uses HMAC tokens from `@baseout/shared` except the customer browser → `apps/web` flow.

```
         Customer browser
                │
                ▼
            apps/web ──── INTERNAL_TOKEN ──→ apps/server ──┬──→ Trigger.dev tasks
                                                ▲          ├──→ R2 / BYOS
                                                │          └──→ customer DBs
        Airtable webhooks ──→ apps/hooks ───────┤              ▲
        Public inbound API ──→ apps/api ────────┤              │
        apps/admin ─────────────────────────────┘              │
                                                               │
        Customer SQL clients ──→ apps/sql ──── Hyperdrive ─────┘
```

## Service-to-Service Token Map

The contract for who can call whom and with what credential. New cross-app routes must reuse one of these mechanisms — do not invent new shapes.

| From → To | Credential | Header | Notes |
|---|---|---|---|
| `apps/web` → `apps/server` | `INTERNAL_TOKEN` (Cloudflare Secret) | `x-internal-token` | Triggers backup/restore runs; reads progress via WebSocket on the per-Space DO |
| `apps/admin` → `apps/server` | `INTERNAL_TOKEN` | `x-internal-token` | Super-admin operations |
| `apps/hooks` → `apps/server` | HMAC service token (`@baseout/shared`) | `x-baseout-signature` | Forwards verified Airtable webhook payloads |
| `apps/api` → `apps/server` | HMAC service token | `x-baseout-signature` | Forwards validated inbound API payloads |
| `apps/sql` → customer DB | Hyperdrive connection string | n/a | Read-only by default; provisioned by `apps/server` |
| `apps/server` → customer DB | Drizzle over postgres-js | n/a | Per-request client; teardown via `ctx.waitUntil(sql.end(...))` |

Frontend ↔ backend secrets must agree on the **same encryption key** for OAuth tokens — the frontend writes encrypted tokens, the backend reads them.

## Public Surfaces

Each app exposes the smallest possible public footprint. Anything not listed here should not exist.

- `apps/web` — full customer UI + `/api/*` for browser interactions; auth-gated by `apps/web/src/middleware.ts`.
- `apps/server` — `/api/health` only (liveness probe). Everything else is `/api/internal/*` and `INTERNAL_TOKEN`-gated.
- `apps/admin` — internal staff UI; Google SSO required.
- `apps/api` — public versioned inbound API at `api.baseout.com`; per-customer API keys.
- `apps/sql` — public read-only PG REST at `sql.baseout.com`; per-customer API keys, Pro+ only.
- `apps/hooks` — Airtable webhook receiver at `webhooks.baseout.com`; HMAC-verifies inbound webhooks before forwarding.

Adding a new public route requires updating this table and the [[security-model]] review checklist.

## Real-Time Progress

`apps/web` reads backup-run progress over WebSocket from the per-Space Durable Object in `apps/server`. The DO is the single source of truth for run state — neither side polls the DB.

WebSocket auth uses a short-lived token issued by `apps/web` against `INTERNAL_TOKEN`.

## Where to Look

Pointers to authoritative sources for this section.

- Authoritative summary: [openspec/config.yaml](../openspec/config.yaml) "Cross-App Communication"
- Frontend/backend split rationale: [CLAUDE.md](../CLAUDE.md) §2
- HMAC service token implementation: `packages/shared` (see [[monorepo-layout]])
- Service architecture diagram: [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §4.3

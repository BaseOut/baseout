# @baseout/server

Headless backup/restore engine. Cloudflare Worker. Public surface: `/api/health`. Internal surface: `/api/internal/*` gated by `INTERNAL_TOKEN`. See [CLAUDE.md §5](../../CLAUDE.md) for backend conventions and runtime constraints.

## Local dev

```bash
cp .dev.vars.example .dev.vars
# Fill in: INTERNAL_TOKEN, DATABASE_URL, BASEOUT_ENCRYPTION_KEY,
#          TRIGGER_SECRET_KEY, TRIGGER_PROJECT_REF.
# DATABASE_URL + BASEOUT_ENCRYPTION_KEY MUST match apps/web's values.
# INTERNAL_TOKEN MUST match apps/web's BACKUP_ENGINE_INTERNAL_TOKEN.

pnpm install
pnpm --filter @baseout/server dev   # → http://localhost:4341
```

## Manual smoke: prove the Connection scaffold

After completing the Airtable Connect OAuth flow in apps/web (so a row exists in `baseout.connections`), run the engine and curl the whoami probe:

```bash
# In one shell:
pnpm --filter @baseout/web dev      # log in; complete Airtable Connect flow

# Get a connection_id:
psql "$DATABASE_URL" -c "select id, status, scopes from baseout.connections order by created_at desc limit 1;"

# In another shell:
pnpm --filter @baseout/server dev

# In a third (or same after the above is up):
INTERNAL_TOKEN=$(grep ^INTERNAL_TOKEN apps/server/.dev.vars | cut -d= -f2-)
curl -X POST \
  -H "x-internal-token: $INTERNAL_TOKEN" \
  http://localhost:4341/api/internal/connections/<connection-id>/whoami
```

Expected response (200):

```json
{
  "connectionId": "...",
  "airtable": {
    "id": "usrXXXXXXXXXXXXXX",
    "scopes": ["data.records:read", "schema.bases:read", "..."],
    "email": "user@example.com"
  }
}
```

Failure modes (status code matrix at [src/pages/api/internal/connections/whoami.ts](src/pages/api/internal/connections/whoami.ts)): `401 unauthorized` (no/wrong token) · `400 invalid_connection_id` · `404 connection_not_found` · `409 connection_status` · `500 server_misconfigured` / `decrypt_failed` · `502 airtable_token_rejected` / `airtable_upstream` · `200` success.

## Tests

```bash
pnpm --filter @baseout/server typecheck
pnpm --filter @baseout/server test
pnpm --filter @baseout/server build
```

The vitest pool (`@cloudflare/vitest-pool-workers`) runs everything inside workerd. The `DATABASE_URL` in `vitest.config.ts` is a stub — DB-touching tests are gated behind `RUN_DB_TESTS=1` (none today). The probe handler's status-code matrix is exercised at the routing layer; full DB + Airtable end-to-end is the manual smoke above.

## Architecture

- `src/index.ts` — Worker entry. Constructs per-request `masterDb`, dispatches routes, schedules `sql.end` teardown via `ctx.waitUntil` in a `finally`.
- `src/middleware.ts` — `INTERNAL_TOKEN` constant-time gate on `/api/internal/*`. No DB work.
- `src/db/worker.ts` — `createMasterDb(env)` factory: postgres-js + drizzle, `max: 1`, `prepare: false`, `search_path: 'baseout,public'`. Hyperdrive in deployed envs, `DATABASE_URL` in `wrangler dev`.
- `src/db/schema/` — read-only mirrors of apps/web's canonical Drizzle schema. Header comments cite the canonical source. Migrations are owned by apps/web.
- `src/lib/crypto.ts` — AES-256-GCM decrypt-only helper. Encrypted writes are not in scope here (apps/web's OAuth callback is the canonical writer).
- `src/durable-objects/{ConnectionDO,SpaceDO}.ts` — PoC stubs. Real coordination (rate-limit, lock, scheduler) lands in their own changes.

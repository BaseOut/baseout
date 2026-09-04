# db/tunnel — local Cloudflare Tunnel to the master database

The master Postgres cluster has **no public ingress** (see
[`architecture/systems-overview.md`](../../architecture/systems-overview.md) §9), so
local development cannot point a connection string at the cluster hostname. This
opens a loopback port that carries Postgres traffic through the same Cloudflare
Tunnel the deployed Workers use — which is what lets the DigitalOcean
trusted-sources IP allowlist go away entirely.

```bash
pnpm db:up        # start (detached) — first run opens a browser for Access
pnpm db:status    # is it up?
pnpm db:down      # stop
pnpm db:up --foreground   # run attached; use when debugging auth
```

Then point every local connection string at the loopback:

```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://<user>:<pw>@127.0.0.1:5433/<db>?sslmode=require
DATABASE_URL=postgresql://<user>:<pw>@127.0.0.1:5433/<db>?sslmode=require
```

in `apps/web/.dev.vars`, `apps/server/.dev.vars`, and `db/.dev.vars`.

## Two auth models, on purpose

| Consumer | Hostname | Access credential |
|---|---|---|
| Local dev (this) | `db.baseout.dev` | **Email policy** — browser login, token cached in `~/.cloudflared/` |
| CI (`db:migrate:tunnel`) | `build-db.baseout.dev` | **Service token** — `CF_CLIENT_ID` / `CF_CLIENT_SECRET` |

A build container cannot open a browser, which is why CI has its own hostname and
its own credential. Keeping them separate also means either door can be revoked
without touching the other.

## Port 5433 is deliberate

It matches `db/scripts/migrate.mjs`, so **one running tunnel serves both** local
dev and `pnpm db:migrate`. The migration runner probes the port first and reuses
an existing tunnel rather than racing a second `cloudflared` against it. Override
with `DB_TUNNEL_LOCAL_PORT` if 5433 is taken.

## Readiness is a Postgres handshake, not an open port

`cloudflared access tcp` opens the loopback listener **immediately**, then blocks
on Access auth. An unauthenticated tunnel therefore *accepts* your connection and
hangs. Checking "is the port open?" reports a ready tunnel that times out on first
use — which is exactly the bug this script had on 2026-09-04.

So `up.mjs` sends a Postgres `SSLRequest` (the 8-byte startup packet every server
answers before authentication) and requires an `'S'`/`'N'` reply. Only a real
server on the far end produces that.

## Troubleshooting

`db:up` prints its own diagnosis in likely order. The three real failures:

**`websocket: bad handshake` (originURL=https://db.baseout.dev)** — the tunnel has
no **ingress rule** for that hostname. DNS alone is not enough: the record points
at Cloudflare, the tunnel doesn't recognise the host, and the request falls through
to the catch-all `http_status:404`, so the websocket upgrade fails. Add an ingress
rule mapping the hostname to `tcp://<private-db-host>:25060`.

**A browser login URL that never resolves** — no Access application covers the
hostname, or your email isn't in its policy. The URL is printed on the
application's own host (`…/cdn-cgi/access/cli?…`), not on `cloudflareaccess.com`.

**`port in use but does not answer as Postgres`** — a stale `cloudflared` is still
waiting on auth, or something else holds 5433. `pnpm db:down`, then
`pnpm db:up --foreground` to watch it interactively.

State lives in `.tunnel.pid` and `.tunnel.log` here; both are gitignored.
`db:down` leaves a port it didn't start alone — it could be your own local
Postgres.

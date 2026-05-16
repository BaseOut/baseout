## Overview

Replace `apps/web`'s URL-based engine client with a Cloudflare Worker **service binding**. The web Worker declares `services: [{ binding: "BACKUP_ENGINE", service: "baseout-server-<env>" }]` in its wrangler config; runtime code calls `env.BACKUP_ENGINE.fetch(request)` instead of `fetch(BACKUP_ENGINE_URL + path, init)`. Cloudflare resolves the binding to the named Worker in the same account and proxies the request through its internal network — no public DNS lookup, no RFC1918 firewall, no edge-policy 403.

The wire format is unchanged: same `POST /api/internal/connections/:id/whoami` path, same JSON body shape, same `x-internal-token` header. From `apps/server`'s perspective the request is indistinguishable from today's public HTTP hit — no engine-side code changes.

## Stack

| Concern | Choice | Note |
|---|---|---|
| Transport | Cloudflare Worker service binding | `env.BACKUP_ENGINE: Fetcher` injected at runtime; Cloudflare resolves to the named sibling Worker in the same account |
| Wire format | JSON POST + `x-internal-token` header | Unchanged from today's HTTP+token client; engine-side `/api/internal/*` middleware is unchanged |
| Web client API | `createBackupEngine({ binding, internalToken })` returning `BackupEngineClient` | Refactor of [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts); option shape changes, return shape stays |
| Server-side surface | Existing routes in [apps/server/src/index.ts](../../../apps/server/src/index.ts) | Zero changes; binding requests arrive as a normal `fetch` event |
| Auth | `INTERNAL_TOKEN` byte-match in [apps/server/src/middleware.ts](../../../apps/server/src/middleware.ts) | Defense-in-depth alongside binding-level isolation |
| Dev resolution | `wrangler dev --remote` for apps/web → deployed `server-dev` | Multi-worker local dev (both with `wrangler dev`, no `--remote`) is a fallback path, out of scope |
| Tests | Vitest with a `Fetcher`-shaped stub | [apps/web/src/lib/backup-engine.test.ts](../../../apps/web/src/lib/backup-engine.test.ts); existing 10 tests, mock shape changes |
| Types | `Fetcher` from `@cloudflare/workers-types` (already in deps via `wrangler types`) | Generated into `worker-configuration.d.ts` after wrangler.jsonc is updated |

## Source Layout

```
apps/web/
├── src/
│   ├── env.d.ts                                        # ProvidedEnv: + BACKUP_ENGINE: Fetcher; − BACKUP_ENGINE_URL
│   ├── lib/
│   │   ├── backup-engine.ts                            # signature: { binding, internalToken } instead of { url, internalToken, fetchImpl }
│   │   └── backup-engine.test.ts                       # mock shape: Fetcher object instead of fetchImpl function
│   └── pages/api/connections/airtable/
│       ├── test.ts                                     # pull env.BACKUP_ENGINE + env.BACKUP_ENGINE_INTERNAL_TOKEN; pass to client
│       ├── _engine-status.ts                           # NO change (pure status mapping)
│       └── test.spec.ts                                # NO change (covers _engine-status, not transport)
├── wrangler.jsonc.example                              # add `services` block to top-level + env.staging + env.production
├── .dev.vars.example                                   # remove BACKUP_ENGINE_URL; keep BACKUP_ENGINE_INTERNAL_TOKEN
└── .dev.vars                                           # local — manually trim BACKUP_ENGINE_URL line; gitignored
apps/server/
├── wrangler.jsonc                                      # add env.dev block (Worker name baseout-server-dev)
├── src/                                                # zero changes
└── ...
shared/internal/
└── ops-setup.md                                        # add "Local dev: deploy baseout-server-dev" section
```

## Wire Format (unchanged)

The web client and engine endpoint already agree on this contract — service bindings preserve it byte-for-byte:

```
POST /api/internal/connections/<connection-uuid>/whoami
Host: baseout-server-dev (or whatever name the binding resolves to — opaque to the caller)
x-internal-token: <BACKUP_ENGINE_INTERNAL_TOKEN, byte-equal to apps/server's INTERNAL_TOKEN>
accept: application/json

(empty body — connection_id is in the path)
```

Engine response codes (per [apps/server/src/pages/api/internal/connections/whoami.ts](../../../apps/server/src/pages/api/internal/connections/whoami.ts)):

- `200` — `{ connectionId, airtable: { id, scopes, email? } }`
- `400` — `{ error: 'invalid_connection_id' }`
- `401` — `{ error: 'unauthorized' }` (middleware token mismatch)
- `404` — `{ error: 'connection_not_found' }`
- `409` — `{ error: 'connection_status', status: 'pending_reauth' | 'invalid' | … }`
- `500` — `{ error: 'server_misconfigured' | 'decrypt_failed', missing? }`
- `502` — `{ error: 'airtable_token_rejected' | 'airtable_upstream', upstream_status? }`

These map through [apps/web/src/pages/api/connections/airtable/_engine-status.ts](../../../apps/web/src/pages/api/connections/airtable/_engine-status.ts) (the helper added today) to the route's HTTP status. That mapping is unaffected by the transport change.

## Web Client API (after refactor)

```ts
// apps/web/src/lib/backup-engine.ts

export interface BackupEngineOptions {
  /** Service binding to the @baseout/server Worker. Provided by Cloudflare at runtime as env.BACKUP_ENGINE. */
  binding: Fetcher
  /** Shared secret matching the engine's INTERNAL_TOKEN. Sent as x-internal-token. */
  internalToken: string
}

export interface BackupEngineClient {
  whoami(connectionId: string): Promise<EngineWhoamiResult>
}

export function createBackupEngine(options: BackupEngineOptions): BackupEngineClient {
  return {
    async whoami(connectionId) {
      const path = `/api/internal/connections/${encodeURIComponent(connectionId)}/whoami`
      // Service bindings expose `.fetch(input, init?)` exactly like global fetch.
      // The base URL in the request is irrelevant — Cloudflare routes by binding,
      // not by Host header — but Fetcher.fetch() requires an absolute URL, so we
      // use a stable placeholder. apps/server reads only the path + headers + body.
      let res: Response
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: 'POST',
          headers: {
            'x-internal-token': options.internalToken,
            accept: 'application/json',
          },
        })
      } catch {
        return { ok: false, code: 'engine_unreachable', status: 0 }
      }
      // … same response parsing as today …
    },
  }
}
```

The placeholder host (`engine`) is irrelevant for routing — Cloudflare's binding layer ignores the host and forwards the request straight to the bound Worker. apps/server reads `request.url`'s pathname and the request headers; both are preserved verbatim.

## Wrangler Config

### apps/web/wrangler.jsonc.example

`services` is **not** an inheritable key (same rule as `vars`, `hyperdrive`, `kv_namespaces`, `send_email` — see the comment block already in the file). Each env block redeclares its full set:

```jsonc
{
  // top-level = dev environment
  "name": "baseout-dev",
  // ...existing config...
  "services": [
    {
      "binding": "BACKUP_ENGINE",
      "service": "baseout-server-dev",
    }
  ],
  "env": {
    "staging": {
      "name": "baseout-staging",
      // ...existing config...
      "services": [
        { "binding": "BACKUP_ENGINE", "service": "baseout-server-staging" }
      ]
    },
    "production": {
      "name": "baseout",
      // ...existing config...
      "services": [
        { "binding": "BACKUP_ENGINE", "service": "baseout-server" }
      ]
    }
  }
}
```

The `service` field is the **Worker name**, not a URL. Cloudflare resolves it to the deployed Worker with that name in the same account. (Wrangler's `services[].environment` field exists but is for cross-environment cases; here each env points at a different Worker name, so we don't need it.)

### apps/server/wrangler.jsonc

apps/server already declares `env.staging` (Worker `server-staging`) and `env.production` (Worker `server`). Add a parallel `env.dev` block (Worker `server-dev`) so apps/web's dev service binding has a deploy target:

```jsonc
"env": {
  "dev": {
    "name": "baseout-server-dev",
    "hyperdrive": [
      {
        "binding": "HYPERDRIVE",
        "id": "ba2652f40f864918a2da0849f24d12a2",
        "localConnectionString": "{{DATABASE_URL}}"
      }
    ]
  },
  "staging": { /* existing */ },
  "production": { /* existing */ }
}
```

The dev block can reuse the existing dev Hyperdrive id (same dev cluster the local apps/web already uses) — no new infra to provision.

## Defense-in-Depth: Why Keep `INTERNAL_TOKEN`

A service binding restricts *who* can call apps/server (only Workers in the same account with the binding declared). It does **not** restrict *what* a bound Worker can do once it's calling. Without the token gate:

- A bug in another bound Worker (apps/api when it lands, apps/hooks, etc.) could trivially hit `/api/internal/connections/<id>/whoami` and exfiltrate decrypted Airtable user identifiers.
- A misconfigured wrangler.jsonc that adds a binding to a Worker that shouldn't have one (e.g. a debug Worker, a cron-only Worker) silently grants engine access.

The token gate at [apps/server/src/middleware.ts](../../../apps/server/src/middleware.ts) is a per-request capability check that doesn't depend on transport-layer trust. Both controls compose cleanly.

## Local Dev Workflow

### Primary path: deploy `server-dev` once, iterate via redeploy

1. **One-time setup** (per developer):
   ```
   pnpm --filter @baseout/server deploy:dev
   ```
   This runs `wrangler deploy --env dev` against `apps/server/wrangler.jsonc` and lands a `baseout-server-dev.openside.workers.dev` Worker on the shared dev account. Hyperdrive resolves to the existing dev Postgres.

2. **Daily dev:**
   ```
   pnpm --filter @baseout/web dev      # apps/web on :4331 with --remote
   ```
   Open `https://localhost:4331/integrations`, click **Test connection** → request flows through the service binding to the deployed `server-dev`.

3. **Engine-side changes:** redeploy via `pnpm --filter @baseout/server deploy:dev` (~10 seconds). This is the only friction added by this change.

### Fallback path (out of scope, documented for future): multi-worker local dev

Wrangler v4 supports `wrangler dev` (no `--remote`) on both apps with a service binding pointing at a sibling local instance. This requires:

- apps/web's wrangler config to use a `services[].environment` field that maps to a local URL.
- Both wrangler dev processes running concurrently on different ports.
- Loss of `--remote` bindings on apps/web (R2, KV, Hyperdrive proxy, send_email).

We're not enabling this in this change because (a) the redeploy cost is low, (b) the loss of `--remote` bindings on apps/web breaks magic-link email and other dev paths the team relies on, and (c) one transport mode for dev is simpler to document and debug than two. If the redeploy friction becomes painful, file a follow-up change.

## Test Strategy

[apps/web/src/lib/backup-engine.test.ts](../../../apps/web/src/lib/backup-engine.test.ts) currently injects a `fetchImpl` mock. After this change, it injects a `Fetcher`-shaped stub:

```ts
function fetcherStub(handler: (req: Request) => Promise<Response>): Fetcher {
  return {
    fetch: ((input, init) => handler(new Request(input as RequestInfo, init))) as Fetcher['fetch'],
  } as Fetcher
}
```

The 10 existing tests stay — only the fixture shape changes:

- "sends POST with x-internal-token to the canonical path"
- "returns ok:true with connectionId + airtable on 200"
- "maps 401 unauthorized to code:unauthorized status:401"
- "maps 404 connection_not_found"
- "maps 409 connection_status and surfaces the connectionStatus field"
- "maps 502 airtable_token_rejected"
- "maps 502 airtable_upstream and surfaces upstreamStatus"
- "maps unknown error codes to engine_error"
- "maps fetch failure (engine unreachable) to engine_unreachable status:0"
- "handles trailing slash on the base URL" — **drop this test.** Trailing slashes are a URL-resolution concern that no longer applies (no URL is being joined). Replace with a test that asserts `binding.fetch` is called with the canonical absolute placeholder URL.

[apps/web/src/pages/api/connections/airtable/test.spec.ts](../../../apps/web/src/pages/api/connections/airtable/test.spec.ts) — no change. It tests `mapEngineCodeToStatus` (pure function, no transport).

## Production Deploy Ordering

Service bindings resolve at deploy time. The first deploy that introduces the binding to apps/web requires `apps/server` to already exist in that env:

1. Deploy `apps/server` to staging: `pnpm --filter @baseout/server deploy:staging`. This creates Worker `server-staging`.
2. Deploy `apps/web` to staging: `pnpm --filter @baseout/web deploy:staging`. The new `services` block resolves to the Worker created in step 1.
3. Same ordering for production: `apps/server` first, then `apps/web`.

Subsequent deploys of either Worker don't need ordering — bindings re-resolve every deploy, and a Worker rename would require a coordinated change anyway.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Service binding cannot be declared without apps/server being deployed first in that env | Documented in proposal §Impact and the deploy ordering above. The first apps/web deploy in staging/prod after this change must be preceded by an apps/server deploy in the same env. |
| `Fetcher` type drift between wrangler-types versions | Wrangler types are regenerated by `pnpm --filter @baseout/web cf-typegen` after wrangler.jsonc changes. Run as a task step. |
| Loss of `BACKUP_ENGINE_URL` breaks any other code path that read it | Grep confirms today's only consumer is the test route. Grep again as a task step before deleting. |
| Multi-worker local dev (the fallback path) — devs accidentally use it without realizing the trade-offs | The .dev.vars.example comment block calls out the deploy precondition explicitly. Multi-worker config is not added to the example file. |
| Token rotation gets harder (touching two Workers' secrets in lockstep) | No change from today — `INTERNAL_TOKEN` rotation already requires updating both apps. The service binding doesn't add a new shared secret. |

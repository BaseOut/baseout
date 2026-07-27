# system-test-harness-spike — spike results

**Run 2026-07-27, wrangler 4.112.0, local (embedded PostgreSQL 16).**
Spike suite: [`apps/web/tests/harness/whoami.spike.test.ts`](../../../apps/web/tests/harness/whoami.spike.test.ts)
— `pnpm --filter @baseout/web test:harness` → **3/3 green in ~2.5s** (after a one-time ~20s embedded-PG init).

## Verdict: ADOPT (bounded) — every spike question answered yes, one upstream bug found + worked around

The scenario no existing test could express now runs locally with no deploy:

```
Node test ─fetch→ consumer Worker (REAL createBackupEngine client from apps/web src)
                    └─ BACKUP_ENGINE service binding (harness-wired) →
                       apps/server Worker — REAL src/index.ts entry:
                       INTERNAL_TOKEN middleware ✓ → Postgres SELECT ✓ →
                       ConnectionDO /token AES-GCM decrypt ✓ →
                       outbound fetch api.airtable.com → MSW mock ✓
                       (authorization header asserted end-to-end)
```

## Answers to the spike questions (tasks 0.1–0.5)

1. **Version floor: `wrangler@4.112.0`** (published 2026-07-17). The changelog announced the harness on 2026-07-21 alongside 4.113.0, but the API is complete in 4.112.0 — which matters because it's the newest version that clears our 7-day `minimumReleaseAge` supply-chain gate today. apps/web is bumped `^4.61.1 → ^4.112.0` (lockfile was resolving 4.88.0). apps/server stays untouched.
2. **DOs work.** `CONNECTION_DO`/`SPACE_DO` (`new_sqlite_classes`) mount from `apps/server/wrangler.test.jsonc` unchanged; the /token gate's `blockConcurrencyWhile` + WebCrypto decrypt ran for real.
3. **Cross-Worker service bindings work, two ways.** A plain `services: [{ binding, service: "<other worker's config name>" }]` entry resolves to the sibling worker in the harness (what the spike uses), and `WorkerInput.bindingOverrides: { BINDING: "workerName" }` exists for overriding without a config edit. First worker in the array is primary → `server.fetch()` dispatches there; `server.getWorker(name)` targets any worker directly.
4. **MSW intercepts Workers' outbound fetch — with one upstream bug** (see below). No harness-specific wiring: plain `setupServer()` from `msw/node`, because the harness proxies each Worker's outbound fetch through the Node process (`outboundService: (req) => globalThis.fetch(req.url, req)`).
5. **Postgres works via plain `DATABASE_URL`** (postgres-js over TCP inside workerd). `WorkerInput.vars` override config vars and `WorkerInput.secrets` override `.dev.vars`/`.env` — we pass both so a developer's real local secrets can never leak into or break the run. Hyperdrive `localConnectionString` was not needed for the server worker and remains unexercised under the harness (web's own config carries one; test when the full web Worker is booted).

## Upstream bug: outbound headers are dropped at the MSW boundary

- **Symptom:** every outbound header — including `authorization` — reaches MSW handlers as empty (`request.headers` = `{}`), so the seeded-token happy path failed with `airtable_token_rejected`.
- **Root cause chain (verified by probe):** the harness's `outboundService` calls `globalThis.fetch(request.url, request)` where `request` is built by **miniflare's bundled undici** (`_Request`). The headers ARE intact on that object, and a native `new Request(url, foreignRequest)` preserves them — but **MSW's fetch interceptor** normalizes the foreign init to `{}`.
- **Workaround (in the spike, ~10 lines):** after `network.listen()` patches fetch, wrap `globalThis.fetch` to re-wrap a foreign `_Request` init into a native `Request` before MSW sees it (`shimForeignRequestFetch()` in the test). With the shim, the strict `authorization: Bearer <seeded token>` assertion passes.
- **Status upstream:** the same `outboundService` line ships in 4.114.0 (latest), so this persists. Worth filing against cloudflare/workers-sdk (repro: any Worker outbound fetch with headers + msw/node) — and re-checking on each wrangler bump so the shim can be deleted.

## Environmental finding: no Docker on this machine → embedded Postgres fallback

`docker-compose.test.yml` is the documented test-DB path, but the dev machine has no container runtime at all (which is also why `test:integration` was never runnable locally). Rather than point tests at the shared DO dev cluster (TLS + conn-pressure risk — the ~19-conn cluster), the harness suite's globalSetup ([`tests/harness/setup/globalSetup.ts`](../../../apps/web/tests/harness/setup/globalSetup.ts)) boots a **disposable embedded PostgreSQL 16** (`embedded-postgres` devDep, PG major matching `postgres:16-alpine`) when nothing is listening on 5432, then delegates to the existing integration globalSetup (wait + `baseout` schema + drizzle migrations). With the Docker DB up it's a pass-through. `@embedded-postgres/darwin-arm64` was added to `allowBuilds` in `pnpm-workspace.yaml` (unpacks the zonky PG binaries). The same fallback could un-block `test:integration` locally — noted as a possible follow-up, not done here.

## What this does NOT change

- The pool-workers suites stay. `runInDurableObject`-grade DO unit tests have no harness equivalent; the harness is the coarse-grained end-to-end layer above them.
- The full Astro **web** Worker was not booted (the consumer fixture imports the real web client lib instead). Booting web's built `dist/` output (assets binding, better-auth session seeding) is the next increment, needed for the local-Playwright goal.

## Recommended adoption order (follow-up changes, file per-app)

1. **`shared-engine-contract-tests`** — a small harness suite covering the web↔server `/api/internal/*` contract (whoami, runs start/cancel, schema-sync…), replacing the `TODO(msw-mocked Airtable/Stripe)` deferrals. Cheapest, highest value; this spike is its template.
2. **`web-harness-playwright`** — boot the built web Worker under the harness and point Playwright at `server.listen()`'s URL instead of requiring `E2E_TARGET_URL` (deploy-to-test goes away for most specs).
3. **MSW adoption per CLAUDE.md §3.4** — with the header shim (until fixed upstream) msw/node now works against real Workers; migrate the hand-rolled `fetchImpl` stubs opportunistically, not as a sweep.

## Files in this change

- `apps/web/tests/harness/whoami.spike.test.ts` — the spike suite (3 tests)
- `apps/web/tests/harness/fixtures/spike-consumer.{ts,wrangler.jsonc}` — consumer Worker wrapping the real `createBackupEngine`
- `apps/web/tests/harness/setup/globalSetup.ts` — embedded-PG fallback + integration setup delegation
- `apps/web/vitest.harness.config.ts` + `test:harness` script
- `apps/web/package.json` — `wrangler ^4.112.0`, `embedded-postgres` (devDeps)
- `pnpm-workspace.yaml` — `allowBuilds` entry for the PG binary package

## How to run

```bash
pnpm --filter @baseout/web test:harness   # Docker not required; boots embedded PG if 5432 is closed
```

## Regression checks (run 2026-07-27)

- `pnpm --filter @baseout/web test:unit` — 114 files / 1303 tests green.
- `pnpm --filter @baseout/web build` — green on wrangler 4.112.0 toolchain.
- `astro check` — 6 errors, all in `tests/integration/airtable-persist.test.ts` (`refreshExpiresIn`), from the concurrent auth-work session; 0 from this change. Same for the 3 `@typescript-eslint/no-explicit-any` rule-resolution lint errors (untouched files; lockfile diff shows only wrangler + embedded-postgres).
- `apps/server` targeted: `connections-whoami` green; `connection-do-token-cache` 2 failures = the documented pre-existing local DO-test issue (apps/server untouched by this change).
- NOT verified: `pnpm --filter @baseout/web dev` (`wrangler dev --remote`) under 4.112.0 — needs the human smoke.

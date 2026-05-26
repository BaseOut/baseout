# OAuth App Registration — Per Provider, Per Environment

Canonical source-of-truth for which redirect URIs must be registered with each
OAuth provider per environment, what is currently registered vs. missing, and
the workarounds that exist while gaps remain.

Owner: whoever is touching OAuth Connect flows in `apps/web`. Update this doc
in the same change that registers a new URI or stands up a new environment.

Related: [ops-setup.md](./ops-setup.md) (Cloudflare/DigitalOcean/GitHub
provisioning), [refactor-roadmap.md](./refactor-roadmap.md).

---

## 1. Environments

| Env       | Browser-facing origin                            | Worker name           | How code reaches it                |
|-----------|--------------------------------------------------|-----------------------|------------------------------------|
| local     | `https://localhost:4331`                         | (no deploy)           | `pnpm --filter @baseout/web dev`   |
| dev       | `https://baseout-dev.openside.workers.dev`       | `baseout-dev`         | `pnpm --filter @baseout/web deploy`            |
| staging   | `https://baseout-staging.openside.workers.dev`   | `baseout-staging`     | `pnpm --filter @baseout/web deploy:staging`    |
| prod      | `https://console.baseout.dev`                    | `baseout`             | `pnpm --filter @baseout/web deploy:production` |

The browser-facing origin is what `PUBLIC_AUTH_BASE_URL` resolves to in each
env (set via wrangler config `vars` for deployed envs, via `--var` flag on the
local `dev` npm script for local — see [§5.1](#51-public_auth_base_url)).

---

## 2. Required redirect URIs per provider

Every supported environment must have its callback URI registered with each
OAuth provider the app uses. The path component is provider-specific:

| Provider     | Callback path on THIS branch (`autumn/backup-fix-local`) |
|--------------|----------------------------------------------------------|
| Airtable     | `/api/connections/airtable/callback`                     |
| Google Drive | `/api/connections/storage/google-drive/callback`         |

So the **required URI for env `X` on provider `P`** is `<X origin> + <P callback path>`.

> ⚠️ **Branch-specific.** Other branches (e.g. `autumn/server-setup`) use a
> different Google Drive callback path (`/oauth/callback/google`). Always match
> the URI registered with the provider to the path your branch's handler
> actually serves. If you cross-merge between branches, audit this table and
> §3 before assuming any URI works.

---

## 3. Current registration status

As of 2026-05-25. **Update every row here when a URI is registered or removed.**

### 3.1 Airtable OAuth app (`client_id=1ae05093-12f2-48f0-b451-6d2ce3f2530a`)

| Required URI                                                                       | Registered? | Owner of registration |
|------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://localhost:4331/api/connections/airtable/callback`                         | ❌ MISSING  | Airtable account that owns the integration (currently unclear — no company account) |
| `https://baseout.local:4331/api/connections/airtable/callback`                     | ✅ done     | same                  |
| `https://baseout-dev.openside.workers.dev/api/connections/airtable/callback`       | ✅ done     | same                  |
| `https://baseout-staging.openside.workers.dev/api/connections/airtable/callback`   | ❌ MISSING  | same                  |
| `https://console.baseout.dev/api/connections/airtable/callback`                    | ❌ MISSING  | same                  |

### 3.2 Google Drive OAuth app (`client_id=283412627943-orknp1mdb...`)

| Required URI (this branch)                                                                       | Registered? | Owner of registration |
|--------------------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://localhost:4331/api/connections/storage/google-drive/callback`                           | ❌ MISSING  | boss (Google Cloud Console for project `baseout-dev`) |
| `https://baseout.local:4331/api/connections/storage/google-drive/callback`                       | ❌ MISSING  | boss                  |
| `https://baseout-dev.openside.workers.dev/api/connections/storage/google-drive/callback`         | ❌ MISSING  | boss                  |
| `https://baseout-staging.openside.workers.dev/api/connections/storage/google-drive/callback`     | ❌ MISSING  | boss                  |
| `https://console.baseout.dev/api/connections/storage/google-drive/callback`                      | ❌ MISSING  | boss                  |

> ⚠️ Boss has `https://localhost:4331/oauth/callback/google` and
> `https://console.baseout.dev/oauth/callback/google` registered today — but
> those paths don't route to a handler on this branch (handler lives at
> `/api/connections/storage/google-drive/callback`, per
> [apps/web/src/pages/api/connections/storage/google-drive/callback.ts](../../apps/web/src/pages/api/connections/storage/google-drive/callback.ts)).
> Drive Connect is currently broken on every env of this branch until §4.1 below
> is actioned.

---

## 4. Gap checklist

Each item below is a single URI to register in a single OAuth app. Tick the
box and update [§3](#3-current-registration-status) when done.

### 4.1 Google Drive (boss-owned, Google Cloud Console)

In the Cloud Console for project `baseout-dev` → OAuth 2.0 Client IDs → the
"Web application" client → **Authorized redirect URIs**:

- [ ] Add `https://localhost:4331/api/connections/storage/google-drive/callback`
- [ ] Add `https://baseout.local:4331/api/connections/storage/google-drive/callback`
- [ ] Add `https://baseout-dev.openside.workers.dev/api/connections/storage/google-drive/callback`
- [ ] Add `https://baseout-staging.openside.workers.dev/api/connections/storage/google-drive/callback`
- [ ] Add `https://console.baseout.dev/api/connections/storage/google-drive/callback`
- [ ] (Optional cleanup) Remove `https://localhost:4331/oauth/callback/google` and `https://console.baseout.dev/oauth/callback/google` — these were registered for a different branch's callback path and don't route on this branch.

### 4.2 Airtable (account-owner action, `airtable.com/create/oauth`)

In the Airtable OAuth integration management UI for integration
`1ae05093-12f2-48f0-b451-6d2ce3f2530a` → **Redirect URLs**:

- [ ] Add `https://localhost:4331/api/connections/airtable/callback`
- [ ] Add `https://baseout-staging.openside.workers.dev/api/connections/airtable/callback`
- [ ] Add `https://console.baseout.dev/api/connections/airtable/callback`

**Blocker:** the Airtable account that owns this integration is not the
team's company account — ownership is currently unclear. Once located,
register the missing URIs above. If unrecoverable, the alternative is to
create a fresh Airtable OAuth integration under a known team account and
swap `AIRTABLE_OAUTH_CLIENT_ID` / `AIRTABLE_OAUTH_CLIENT_SECRET` in every
env's secrets.

**Airtable does NOT expose a public API for managing OAuth integrations.**
Only the OAuth flow endpoints (authorize / token / refresh) are public.
Updating the registered URI list must happen via the Airtable web UI.

---

## 5. Workarounds while gaps exist

### 5.1 `PUBLIC_AUTH_BASE_URL`

The redirect URI handed to each OAuth provider is computed as
`PUBLIC_AUTH_BASE_URL + <provider callback path>` (see
[apps/web/src/lib/airtable/config.ts](../../apps/web/src/lib/airtable/config.ts)
`getRedirectUri`, and the parallel function in `google-drive/config.ts`).
`PUBLIC_AUTH_BASE_URL` is sourced from:

- **Local dev:** the `--var PUBLIC_AUTH_BASE_URL:...` flag in
  [apps/web/package.json](../../apps/web/package.json) `dev` script. In
  wrangler 4.x, the `--var` CLI flag **wins over `.dev.vars`** — overriding
  it in `.dev.vars` has no effect.
- **Deployed envs:** the `vars.PUBLIC_AUTH_BASE_URL` field of each
  `env.<env>.vars` block in [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc).

When the URI for the chosen env isn't registered with a provider, the
authorize call fails with `invalid client_id or mismatched redirect_uri`
(Airtable) or `redirect_uri_mismatch` (Google).

### 5.2 Use the deployed `baseout-dev` worker for real Airtable Connect

Until [§4.2](#42-airtable-account-owner-action-airtablecomcreateoauth) is
unblocked, the `baseout-dev` worker is the only env where Airtable Connect
works against the real integration. The deployed worker shares the master
Postgres (via Hyperdrive) with local dev, so a Connection made on baseout-dev
is immediately visible to your local `apps/web` once the page reloads.

Cross-env Connect routine:

1. Ensure `AIRTABLE_STUBS_ENABLED` is empty in your local `.dev.vars`
   (otherwise local routes Airtable hops to fakes).
2. Open `https://baseout-dev.openside.workers.dev/integrations` in your browser.
3. Click **Connect Airtable** there. Real OAuth round-trip; URI matches the
   registered list.
4. Switch to `https://localhost:4331/integrations`. The Connection is now
   `active` for your local app because the row lives in the shared DB.

### 5.3 Stub mode for code-path testing without real OAuth

Set `AIRTABLE_STUBS_ENABLED=1` in `apps/web/.dev.vars`. The code at
[apps/web/src/lib/airtable/config.ts:97](../../apps/web/src/lib/airtable/config.ts#L97)
detects this and routes the OAuth flow + Meta API calls to local stub
routes under `/api/_stub/airtable/*`. Useful when you want to exercise the
PKCE / token-exchange / Meta-client code paths against fake data, without
needing a registered redirect URI anywhere.

Restart wrangler after toggling this. Mutually exclusive with [§5.2](#52)
(stub mode short-circuits the real Airtable hops).

### 5.4 Drive on baseout-dev

Currently blocked. The Google OAuth app has no registered URI for the
`baseout-dev` worker — see [§4.1](#41-google-drive-boss-owned-google-cloud-console).
Until the boss adds it, Drive Connect from `baseout-dev.openside.workers.dev`
fails with `redirect_uri_mismatch`. For local Drive Connect, use
`https://localhost:4331/integrations` (already registered with Google).

---

## 6. Deploy commands

Reproduced here for convenience; canonical script defs live in
[apps/web/package.json](../../apps/web/package.json) and
[apps/server/package.json](../../apps/server/package.json).

| Command                                            | Deploys to                                     | Worker name        |
|----------------------------------------------------|------------------------------------------------|--------------------|
| `pnpm --filter @baseout/web run deploy`            | `https://baseout-dev.openside.workers.dev`     | `baseout-dev`      |
| `pnpm --filter @baseout/web run deploy:staging`    | `https://baseout-staging.openside.workers.dev` | `baseout-staging`  |
| `pnpm --filter @baseout/web run deploy:production` | `https://console.baseout.dev`                  | `baseout`          |
| `pnpm --filter @baseout/server deploy:dev`         | `https://baseout-server-dev.openside.workers.dev` | `baseout-server-dev` |

> ⚠️ For the web scripts use `pnpm ... run deploy` (not `pnpm ... deploy`).
> pnpm intercepts the bare `deploy` keyword as its own builtin and fails
> with `ERR_PNPM_INVALID_DEPLOY_TARGET`. The `run` token is required to
> invoke the npm script defined in package.json.

**Secrets sync on deploy.** Each `deploy` / `deploy:dev` script chains
`pnpm run secrets:sync(:dev)` after `wrangler deploy`, which runs
`scripts/sync-secrets.mjs --env <env>` and bulk-writes every `.dev.vars`
entry as a Worker secret (filtered against keys already declared as
plaintext `vars` in `wrangler.jsonc`). This makes `apps/{web,server}/.dev.vars`
the single source of truth for deployed secrets — manual
`wrangler secret put` calls are no longer required and should not be used
(they reintroduce drift, see [§8](#8-failure-modes-so-you-dont-re-learn-them)).

Local `pnpm --filter @baseout/web dev` is **not** a deploy — it runs the
local code in a Cloudflare edge sandbox accessed at `https://localhost:4331`
or `https://baseout.local:4331`. Your local changes never affect any of the
deployed URLs above until you explicitly run a `deploy` command.

---

## 7. Process: adding a new env or new provider

### 7.1 New environment (e.g. a per-PR preview worker)

1. Add the env's `vars.PUBLIC_AUTH_BASE_URL` to
   [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc) under
   `env.<new-env>`.
2. Add a row to each provider's table in [§3](#3-current-registration-status).
3. Register the new env's callback URI with each provider — file the work
   in [§4](#4-gap-checklist).
4. Add a deploy script to [apps/web/package.json](../../apps/web/package.json)
   if it's a recurring target.
5. Document the new row in [§6](#6-deploy-commands).

### 7.2 New OAuth provider (e.g. when Dropbox / Box / OneDrive land)

1. Decide the callback path. Add a row to [§2](#2-required-redirect-uris-per-provider).
2. Create a `§3.N` subsection: list every env's required URI and current
   registration status.
3. File the per-URI registration work in [§4](#4-gap-checklist).
4. Document workarounds (stub mode, cross-env Connect) in [§5](#5-workarounds-while-gaps-exist)
   if they exist for that provider.

---

## 8. Failure modes (so you don't re-learn them)

| Symptom                                                          | Likely cause                                                                              | Where to look |
|------------------------------------------------------------------|-------------------------------------------------------------------------------------------|---------------|
| Airtable redirects to "invalid client_id or mismatched redirect_uri" | Current env's URI isn't in [§3.1](#31-airtable-oauth-app-client_id1ae05093-12f2-48f0-b451-6d2ce3f2530a) | URL bar — decode the `redirect_uri=...` query param, compare against §3.1 |
| Google redirects to "Error 400: redirect_uri_mismatch"           | Current env's URI isn't in [§3.2](#32-google-drive-oauth-app-client_id28341262794) | URL bar — same drill |
| Local `.dev.vars` change to `PUBLIC_AUTH_BASE_URL` has no effect | wrangler 4.x precedence: `--var` flag in `dev` script wins                                | [apps/web/package.json](../../apps/web/package.json) line 9 |
| Airtable Connect via baseout-dev works but local doesn't see the Connection | Stub mode is on locally — `AIRTABLE_STUBS_ENABLED=1` short-circuits the real DB read | [apps/web/.dev.vars](../../apps/web/.dev.vars) |
| OAuth refresh cron flips Airtable Connection to `invalid`        | Token expired and Airtable refused refresh — expected behavior. Reconnect per [§5.2](#52-use-the-deployed-baseout-dev-worker-for-real-airtable-connect). | [apps/server/src/lib/oauth-refresh.ts](../../apps/server/src/lib/oauth-refresh.ts) |

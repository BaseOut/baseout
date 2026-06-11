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
| local     | `https://baseout.local:4331`                     | (no deploy)           | `pnpm --filter @baseout/web dev`   |
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
| Box          | `/api/connections/storage/box/callback`                  |
| Dropbox      | `/api/connections/storage/dropbox/callback`              |
| OneDrive     | `/api/connections/storage/onedrive/callback`             |

So the **required URI for env `X` on provider `P`** is `<X origin> + <P callback path>`.

> ⚠️ **Branch-specific.** Other branches (e.g. `autumn/server-setup`) use a
> different Google Drive callback path (`/oauth/callback/google`). Always match
> the URI registered with the provider to the path your branch's handler
> actually serves. If you cross-merge between branches, audit this table and
> §3 before assuming any URI works.

---

## 3. Current registration status

As of 2026-06-03. **Update every row here when a URI is registered or removed.**

`localhost:4331` is no longer a supported origin (see §5.5). Any
`localhost:4331/...` URI registered in a provider console should be **removed**
in the same pass that adds the `baseout.local:4331/...` replacement — the
gap checklist in §4 lists the removals.

### 3.1 Airtable OAuth app (`client_id=1ae05093-12f2-48f0-b451-6d2ce3f2530a`)

| Required URI                                                                       | Registered? | Owner of registration |
|------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://baseout.local:4331/api/connections/airtable/callback`                     | ✅ done     | Airtable account that owns the integration (currently unclear — no company account) |
| `https://baseout-dev.openside.workers.dev/api/connections/airtable/callback`       | ✅ done     | same                  |
| `https://baseout-staging.openside.workers.dev/api/connections/airtable/callback`   | ❌ MISSING  | same                  |
| `https://console.baseout.dev/api/connections/airtable/callback`                    | ❌ MISSING  | same                  |

### 3.2 Google Drive OAuth app (`client_id=283412627943-orknp1mdb...`)

| Required URI (this branch)                                                                       | Registered? | Owner of registration |
|--------------------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://baseout-dev.openside.workers.dev/api/connections/storage/google-drive/callback`         | ❌ MISSING  | boss (Google Cloud Console for project `baseout-dev`) |
| `https://baseout-staging.openside.workers.dev/api/connections/storage/google-drive/callback`     | ❌ MISSING  | boss                  |
| `https://console.baseout.dev/api/connections/storage/google-drive/callback`                      | ❌ MISSING  | boss                  |

> ⚠️ **There is intentionally no `baseout.local:4331` row.** Unlike Airtable
> (§3.1), Google **cannot** register a `baseout.local` redirect URI: Google's
> OAuth policy requires the host TLD to be on the
> [public suffix list](https://publicsuffix.org/), and `.local` is not on it.
> Attempting to add it is rejected, and at sign-in time a `baseout.local`
> redirect URI returns `Error 400: invalid_request` / "doesn't comply with
> Google's OAuth 2.0 policy" (NOT `redirect_uri_mismatch` — see §8). This is
> why Google Drive Connect can only be exercised on a deployed env (§5.4),
> and why only the three real-domain (public-suffix) URIs above are listed.
> See https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation.
>
> ⚠️ Boss has `https://localhost:4331/oauth/callback/google` and
> `https://console.baseout.dev/oauth/callback/google` registered today — both
> should be **removed** as part of the §4.1 cleanup: those paths don't route
> to a handler on this branch (handler lives at
> `/api/connections/storage/google-drive/callback`, per
> [apps/web/src/pages/api/connections/storage/google-drive/callback.ts](../../apps/web/src/pages/api/connections/storage/google-drive/callback.ts)),
> and `localhost:4331` is no longer a supported origin (§5.5). Drive Connect
> is currently broken on every env of this branch until §4.1 registers the
> three deployed-env URIs above.

### 3.3 Box OAuth app (`client_id=g80ko45r0dpseeih11z4aoi4a2s242jm`)

| Required URI (this branch)                                                                | Registered? | Owner of registration |
|-------------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://baseout.local:4331/api/connections/storage/box/callback`                         | ❌ MISSING  | autumn (Box Developer Console) |
| `https://baseout-dev.openside.workers.dev/api/connections/storage/box/callback`           | ❌ MISSING  | autumn                |
| `https://baseout-staging.openside.workers.dev/api/connections/storage/box/callback`       | ❌ MISSING  | autumn                |
| `https://console.baseout.dev/api/connections/storage/box/callback`                        | ❌ MISSING  | autumn                |

> Box App config also holds the scope set (not the OAuth flow). Confirm
> `Write all files and folders stored in Box` is enabled (i.e. `root_readwrite`),
> and that `App Folder` mode is OFF — we want user-folder access, not
> app-folder isolation. Box rotates refresh tokens on every refresh; the
> stored `refresh_token` MUST be replaced on each successful refresh or the
> next refresh fails with `invalid_grant`. Implementation lives in
> `apps/server/src/lib/storage/refresh-box.ts` (forthcoming, Commit 3).

### 3.4 Dropbox OAuth app (`client_id=x17ycest5xs90ui`)

| Required URI (this branch)                                                                | Registered? | Owner of registration |
|-------------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://localhost:4331/api/connections/storage/dropbox/callback`                         | ⚠️ remove   | boss (Dropbox App Console) — unsupported origin, replace with baseout.local |
| `https://baseout.local:4331/api/connections/storage/dropbox/callback`                     | ❌ MISSING  | boss                  |
| `https://baseout-dev.openside.workers.dev/api/connections/storage/dropbox/callback`       | ❌ MISSING  | boss                  |
| `https://baseout-staging.openside.workers.dev/api/connections/storage/dropbox/callback`   | ✅ done     | boss                  |
| `https://baseout.dev/api/connections/storage/dropbox/callback`                            | ✅ done     | boss                  |

> The `baseout-dev` URI is the one that actually blocks local-dev smoke
> testing: the `wrangler dev --remote` script makes the local worker code
> see `https://baseout-dev.openside.workers.dev` as `url.origin` (even
> though the browser URL bar shows `baseout.local:4331`). Staging + prod
> URIs registered today are insufficient to complete a Connect flow
> end-to-end until that one's added. Same gotcha applies to any future
> BYOS provider so long as the dev script keeps `--remote`. See
> [boss-todo.md §2](../../boss-todo.md) (local-only, gitignored).
>
> NOTE: the prod row here uses `baseout.dev` per the actual deployed
> wrangler.jsonc — the §1 Environments table claiming `console.baseout.dev`
> is stale across this file and needs a separate sweep (Airtable §3.1 +
> Drive §3.2 currently inherit the stale value).

> Dropbox App is registered with the **App folder** permission type (the
> app is sandboxed to its dedicated `/Apps/Baseout/` folder in each user's
> Dropbox — we can only see and modify content we create there). From the
> API's perspective the app folder IS the root: a `path: '/Baseout-<spaceId>'`
> in our calls creates `/Apps/Baseout/Baseout-<spaceId>` from the user's view.
> No code adjustment is required vs Full Dropbox — same call shapes, narrower
> sandbox.
>
> Permissions-tab scopes are enabled: `files.content.write`,
> `files.content.read`, `files.metadata.write`, `files.metadata.read`,
> `account_info.read`. Scopes are NOT passed via the OAuth URL — they live
> on the app.
>
> Dropbox refresh tokens are **stable** (no rotation, no expiry by default)
> — like Google Drive, unlike Box; the engine route preserves the stored
> `oauth_refresh_token_enc` on refresh rather than re-encrypting.
> Implementation lives in `apps/server/src/lib/storage/refresh-dropbox.ts`
> (forthcoming, Commit 3).

### 3.5 Microsoft OneDrive OAuth app (`client_id=72f34ac4-a827-4a86-949e-57ccb7154f7f`)

| Required URI (this branch)                                                                  | Registered? | Owner of registration |
|---------------------------------------------------------------------------------------------|-------------|-----------------------|
| `https://baseout.local:4331/api/connections/storage/onedrive/callback`                      | ❌ MISSING  | boss (Azure Portal). Confirmed missing 2026-06-04: `login.live.com` returned `invalid_request: redirect_uri ... is not valid` for `client_id=72f34ac4…`. |
| `https://baseout-dev.openside.workers.dev/api/connections/storage/onedrive/callback`        | ❓ unknown  | boss                  |
| `https://baseout-staging.openside.workers.dev/api/connections/storage/onedrive/callback`    | ❓ unknown  | boss                  |
| `https://baseout.dev/api/connections/storage/onedrive/callback`                             | ❓ unknown  | boss                  |

> Any pre-existing `https://localhost:4331/api/connections/storage/onedrive/callback`
> registration is unsupported (§5.5) and should be removed if found.

> **Public-client + PKCE.** The Azure App is registered with
> `allowPublicClient: true` in its manifest. There is NO client secret — the
> token exchange and refresh calls post only `client_id` + `code_verifier`
> (initial) or `client_id` + `refresh_token` (refresh), plus `scope`.
> Verified against Microsoft Entra Identity Platform docs: *"For SPAs and
> native clients on the Microsoft identity platform, the authorization code
> flow requires the use of a PKCE code challenge … Client secrets should
> not be used."* This is intentional and matches the boss's app configuration.

> **`/common` tenant slot.** Authorize and token URLs use `/common` (not the
> Directory tenant ID `71787c81-005c-42a9-8be3-fb596c4feadd`). `/common`
> accepts BOTH work/school AND personal Microsoft accounts (outlook.com,
> hotmail, gmail-linked Live, Xbox, Skype) — required by Features §4.4 for
> Trial-tier support. This depends on the Azure App's "Supported account
> types" being set to "any organizational directory + personal Microsoft
> accounts" (§4.5 step 2 below).

> **Refresh-token rotation.** Microsoft returns a NEW `refresh_token` on
> EVERY successful refresh response (like Box, unlike Drive/Dropbox). The
> engine refresh route at `apps/server/src/lib/storage/refresh-onedrive.ts`
> re-encrypts and persists the new value on every success. A 200-OK
> response missing `refresh_token` is treated as `invalid` and fails loud.

> **Scope `Files.ReadWrite.AppFolder` (narrow).** Microsoft Graph sandboxes
> Baseout to a per-user `/Apps/<AppDisplayName>/` folder; we cannot read or
> write outside it. Matches Dropbox's App-folder pattern. Same call shapes
> as the broader `Files.ReadWrite` scope — only the API root differs
> (`/me/drive/special/approot` instead of `/me/drive/root`).

---

## 4. Gap checklist

Each item below is a single URI to register in a single OAuth app. Tick the
box and update [§3](#3-current-registration-status) when done.

### 4.1 Google Drive (boss-owned, Google Cloud Console)

In the Cloud Console for project `baseout-dev` → OAuth 2.0 Client IDs → the
"Web application" client → **Authorized redirect URIs**:

- [ ] Add `https://baseout-dev.openside.workers.dev/api/connections/storage/google-drive/callback`
- [ ] Add `https://baseout-staging.openside.workers.dev/api/connections/storage/google-drive/callback`
- [ ] Add `https://console.baseout.dev/api/connections/storage/google-drive/callback`
- [ ] Remove `https://localhost:4331/oauth/callback/google` and `https://console.baseout.dev/oauth/callback/google` — wrong callback path AND `localhost:4331` is no longer a supported origin (§5.5). Confirm the three deployed-env rows above are added BEFORE removing.
- [ ] **Do NOT add `https://baseout.local:4331/...`.** Google rejects it — `.local` isn't on the public suffix list, so it can't be registered and would fail at sign-in with `Error 400: invalid_request` regardless (§3.2, §8). Local Drive Connect is impossible by design; test on the deployed dev worker instead (§5.4).

### 4.2 Airtable (account-owner action, `airtable.com/create/oauth`)

In the Airtable OAuth integration management UI for integration
`1ae05093-12f2-48f0-b451-6d2ce3f2530a` → **Redirect URLs**:

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

### 4.3 Box (autumn-owned, Box Developer Console)

In the Box Developer Console for the Baseout app (Client ID
`g80ko45r0dpseeih11z4aoi4a2s242jm`) → **Configuration** tab → **OAuth 2.0
Redirect URIs**:

- [ ] Add `https://baseout.local:4331/api/connections/storage/box/callback`
- [ ] Add `https://baseout-dev.openside.workers.dev/api/connections/storage/box/callback`
- [ ] Add `https://baseout-staging.openside.workers.dev/api/connections/storage/box/callback`
- [ ] Add `https://console.baseout.dev/api/connections/storage/box/callback`
- [ ] Confirm Application Scopes include **Write all files and folders stored in Box** (`root_readwrite`)
- [ ] Confirm **App Folder** mode is OFF (we need user-folder access, not app-folder isolation)
- [ ] After saving in Box, click **Submit for review** if the app is in
      development mode and any non-dev env needs to use it. Until reviewed,
      OAuth only works for the developer account that owns the app.

The `baseout.local` and `baseout-dev` URIs are sufficient for Commit 2 + 3 smoke;
staging + prod URIs can wait.

### 4.4 Dropbox (boss-owned, Dropbox App Console) — PARTIAL

In the Dropbox App Console (https://www.dropbox.com/developers/apps) for the
Baseout app (App key `x17ycest5xs90ui`):

**Settings tab → OAuth 2 → Redirect URIs:**

- [ ] Add `https://baseout.local:4331/api/connections/storage/dropbox/callback` *(**REQUIRED** — canonical local origin per §5.5; `/etc/hosts` already maps baseout.local → 127.0.0.1 via `pnpm setup:hosts`.)*
- [ ] Add `https://baseout-dev.openside.workers.dev/api/connections/storage/dropbox/callback` *(**REQUIRED for local-dev smoke** — see §3.4 note above. Boss to add when back.)*
- [ ] Remove `https://localhost:4331/api/connections/storage/dropbox/callback` — unsupported origin (§5.5). Confirm the baseout.local row above is added BEFORE removing.
- [x] `https://baseout-staging.openside.workers.dev/api/connections/storage/dropbox/callback`
- [x] `https://baseout.dev/api/connections/storage/dropbox/callback`

**Settings tab → Permission type:**

- [x] **App folder** is selected. The Baseout app is sandboxed to
      `/Apps/Baseout/` in each user's Dropbox — we can only see and modify
      content we create there. Multi-Space layout still works: each Space
      gets its own `Baseout-<spaceId>` subfolder under `/Apps/Baseout/`,
      and our API calls treat the app folder as `/` (a `path:
      '/Baseout-<spaceId>'` call creates `/Apps/Baseout/Baseout-<spaceId>`
      from the user's view).

**Permissions tab — enabled scopes:**

- [x] `files.content.write` (upload + replace files)
- [x] `files.content.read` (read + download — useful for restore + verify)
- [x] `files.metadata.write` (create folders + delete folders)
- [x] `files.metadata.read` (list folders + file metadata)
- [x] `account_info.read` (used by /2/users/get_current_account on initial Connect to populate oauth_account_email)

> Dropbox scopes are committed against the app, not requested via the OAuth
> URL — saving the Permissions tab applies to all subsequent OAuth flows.
> If the app is still in Development mode, only the developer account that
> owns the app can OAuth — submit for Production review when ready for
> staging + prod.

### 4.5 Microsoft / OneDrive (boss-owned, Azure Portal) — STATUS UNKNOWN

In the Azure Portal (https://portal.azure.com) under Microsoft Entra ID →
App registrations → the Baseout app (Application ID
`72f34ac4-a827-4a86-949e-57ccb7154f7f`):

**Authentication → Platform: Web → Redirect URIs:**

- [ ] `https://baseout.local:4331/api/connections/storage/onedrive/callback` *(canonical local origin — §5.5; **CONFIRMED MISSING 2026-06-04** — local OneDrive Connect blocked until this is added: `login.live.com` → `invalid_request: redirect_uri ... is not valid`)*
- [ ] `https://baseout-dev.openside.workers.dev/api/connections/storage/onedrive/callback` *(REQUIRED for local-dev smoke — `wrangler dev --remote` makes the worker's `url.origin` resolve to this host)*
- [ ] `https://baseout-staging.openside.workers.dev/api/connections/storage/onedrive/callback`
- [ ] `https://baseout.dev/api/connections/storage/onedrive/callback`
- [ ] If `https://localhost:4331/api/connections/storage/onedrive/callback` is registered, **remove** it — unsupported origin (§5.5).

**Authentication → Advanced settings:**

- [ ] **Allow public client flows** = **Yes** (manifest `allowPublicClient: true`). Without this, Microsoft's `/token` endpoint rejects requests that omit `client_secret` with `AADSTS70002` ("The request body must contain the following parameter: 'client_secret or client_assertion'"). Public-client mode is the entire reason we can ship OneDrive without a client secret.

**Authentication → Supported account types:**

- [ ] **Accounts in any organizational directory (Multitenant) and personal Microsoft accounts.** Without the "personal Microsoft accounts" half, outlook.com / hotmail / live.com / Xbox / Skype sign-ins fail with `AADSTS50020` or `AADSTS500113`, which makes Trial + Starter tiers non-functional per Features §4.4.

**API permissions → Microsoft Graph → Delegated:**

- [ ] `Files.ReadWrite.AppFolder` — sandboxed per-user OneDrive write access. Narrower than `Files.ReadWrite` (principle of least privilege; matches Dropbox's App-folder pattern).
- [ ] `offline_access` — required to receive a refresh_token in the OAuth response.
- [ ] `User.Read` — used on initial Connect to populate `oauth_account_email` + `provider_account_id`.
- [ ] No admin consent button required for personal MSA scopes; the consent screen grants these per-user.

> **What we don't need on the Azure side:** a client secret, a Service
> Principal, certificate uploads, or any tenant-restricted access policy.
> Public-client + PKCE is the documented path for consumer-facing OAuth on
> the Microsoft identity platform — the Baseout app is a "native client"
> from Microsoft's classification regardless of the Web-platform redirect
> URI registration.

> **App display name** — appears on the Microsoft consent screen. If the
> current name is "Baseout DEV" (or anything similarly internal-looking),
> consider renaming to "Baseout" (with an env suffix like "Baseout (dev)"
> if needed) before the first user-visible smoke. Cosmetic, not a
> functional blocker.

> **Local-dev redirect-URI override.** When using `wrangler dev --remote`,
> the worker code sees its `url.origin` as the deployed preview-worker URL
> (e.g. `https://baseout-dev.openside.workers.dev`) even though the
> browser shows `baseout.local:4331`. `apps/web/.dev.vars` should carry
> `MICROSOFT_REDIRECT_URI=https://baseout.local:4331/api/connections/storage/onedrive/callback`
> so the authorize call sends a URI Microsoft will recognise. Adjust this
> value to whichever baseout-local / baseout-dev URI the boss has
> registered. Any pre-existing localhost override should be replaced —
> §5.5 marks `localhost:4331` as unsupported.

---

## 5. Workarounds while gaps exist

### 5.1 `PUBLIC_AUTH_BASE_URL`

The redirect URI handed to each OAuth provider is computed as
`PUBLIC_AUTH_BASE_URL + <provider callback path>`. Each provider's
`start.ts` / `authorize.ts` handler reads
`workerEnv.PUBLIC_AUTH_BASE_URL ?? url.origin` and passes that origin into
`getRedirectUri()` (see
[apps/web/src/pages/api/connections/airtable/start.ts](../../apps/web/src/pages/api/connections/airtable/start.ts)
and the parallel `authorize.ts` in each storage provider's directory under
[apps/web/src/pages/api/connections/storage/](../../apps/web/src/pages/api/connections/storage/)).

The `PUBLIC_AUTH_BASE_URL ?? url.origin` preference matters because
under `wrangler dev --remote` the worker code sees `url.origin` as the
deployed preview-worker URL (e.g. `https://baseout-dev.openside.workers.dev`)
even though the browser's URL bar is `https://baseout.local:4331`. If
`redirectUri` is built from `url.origin`, the OAuth provider redirects the
browser to the deployed worker, where the browser's session + handoff
cookies (scoped to `baseout.local`) don't follow — the user lands at the
deployed worker's `/login` instead of the expected
`/integrations?connected=1`. Anchoring on `PUBLIC_AUTH_BASE_URL` keeps the
callback on the origin the browser is actually using. Recorded in §8 below.

`PUBLIC_AUTH_BASE_URL` is sourced from:

- **Local dev:** the `--var PUBLIC_AUTH_BASE_URL:https://baseout.local:4331`
  flag assembled in [apps/web/scripts/dev.mjs](../../apps/web/scripts/dev.mjs)
  (the `dev` npm script now delegates to that runner). In wrangler 4.x, the
  `--var` CLI flag **wins over `.dev.vars`** — overriding it in `.dev.vars`
  has no effect.
- **Deployed envs:** the `vars.PUBLIC_AUTH_BASE_URL` field of each
  `env.<env>.vars` block in [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc).

Per-provider overrides (`DROPBOX_REDIRECT_URI`, `MICROSOFT_REDIRECT_URI`)
still win inside `getRedirectUri()` when set. They exist as escape hatches
for providers whose OAuth app hasn't registered the
`PUBLIC_AUTH_BASE_URL`-derived URI yet. Point overrides at the
`baseout.local:4331/...` (or deployed-env) URI you've actually registered
— never at `localhost:4331` (§5.5). Remove the override once the matching
canonical URI is registered with the provider.

When the URI for the chosen env isn't registered with a provider, the
authorize call fails with `invalid client_id or mismatched redirect_uri`
(Airtable), `redirect_uri_mismatch` (Google), or
`invalid_request: ... redirect_uri ... is not valid` (Microsoft).

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
4. Switch to `https://baseout.local:4331/integrations`. The Connection is now
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

### 5.4 Drive: deployed-only (never local)

**Google Drive Connect cannot run from local `https://baseout.local:4331`.**
This is permanent, not a missing-registration gap: Google's OAuth policy
forbids the `.local` TLD (it's not on the public suffix list, §3.2), so a
`baseout.local` redirect URI is rejected at sign-in with `Error 400:
invalid_request` / "doesn't comply with Google's OAuth 2.0 policy" (§8). It
can't be registered to fix this — `.local` is simply not registerable. (This
is the one provider where the §5.5 "baseout.local is where everything works"
rule does not hold — Airtable and the other storage providers are fine on
baseout.local.)

**Test path (deployed dev worker):** register the three real-domain URIs in
§3.2 — see [§4.1](#41-google-drive-boss-owned-google-cloud-console) — then
deploy web (`pnpm --filter @baseout/web run deploy`) and Connect from
`https://baseout-dev.openside.workers.dev/integrations`. The deployed worker
sets `PUBLIC_AUTH_BASE_URL=https://baseout-dev.openside.workers.dev` (a
public-suffix domain Google accepts), so it already builds the correct
redirect URI — no code change needed. Until the boss registers the dev-worker
URI, that env returns `redirect_uri_mismatch`; once registered it works.

### 5.5 Canonical local dev URL + trusted cert (mkcert)

**`https://baseout.local:4331` is the only supported local dev origin.**
`localhost:4331` is no longer recognised as a local-dev host by the app —
`LOCAL_DEV_HOSTS`, `AUTH_BASE_URL.allowedHosts`, and `DEV_TRUSTED_ORIGINS`
were narrowed to baseout.local in commit-batch around 2026-06-03, and the
helper tests pin that behaviour. Landing on `localhost:4331` will fail
loud: Better Auth refuses the Origin/Referer check, magic-link emails
point at `baseout.local`, and Secure cookies stay on rather than silently
dropping. baseout.local is the single origin where everything works
end-to-end:

- It is the only host Airtable's OAuth app has a registered redirect URI for
  (§3.1), so OAuth Connect can't work anywhere else.
- `PUBLIC_AUTH_BASE_URL` is pinned to it (§5.1), and Better Auth uses that
  one origin to build the magic-link email URL, run the CSRF/Origin check,
  and scope the session cookie. Logging in from `localhost` gets an email
  link pointing at `baseout.local` (cookie lands there, not on localhost) and
  the sign-in POST is rejected with `Invalid origin`. The worker's `Host`
  header is the `*.workers.dev` edge host under `wrangler dev --remote`, so
  Better Auth **cannot** infer the browser origin per-request — a single
  pinned origin is unavoidable.

> **Exception — Google Drive.** "Everything works end-to-end on baseout.local"
> holds for login, Airtable, and the other storage providers, but **not**
> Google Drive: Google's OAuth policy rejects the `.local` TLD outright (§3.2,
> §8), so Drive Connect is the one flow that must be exercised on a deployed
> env (§5.4), not locally.

**One-time cert setup** (removes the browser warning that otherwise nudges
you toward `localhost`, whose self-signed wrangler cert happens to be valid):

```
brew install mkcert            # prerequisite, once per machine
pnpm --filter @baseout/web setup:certs
```

`setup:certs` runs `mkcert -install` (adds a local CA to the system trust
store — may prompt for sudo) and writes a cert for `baseout.local` to
`apps/web/.certs/` (gitignored). `pnpm dev` ([apps/web/scripts/dev.mjs](../../apps/web/scripts/dev.mjs))
auto-detects that cert and passes `--https-cert-path`/`--https-key-path` to
wrangler; with no cert it falls back to wrangler's self-signed cert (login
still works — the session cookie is forced non-Secure in local dev, see §8 —
but the browser shows a one-time warning).

**`/etc/hosts` mapping (required):** `baseout.local → 127.0.0.1`. `dev.mjs`
preflights this — if `baseout.local` doesn't resolve to loopback it fails
fast with the fix command rather than dead-ending. Add it once with:

```
pnpm --filter @baseout/web setup:hosts   # appends `127.0.0.1 baseout.local` (uses sudo)
# or manually:  echo '127.0.0.1 baseout.local' | sudo tee -a /etc/hosts
```

`dev.mjs` then binds wrangler on `localhost` (wrangler prints that — there's
no flag to make it serve a custom hostname; per the Cloudflare docs the
`/etc/hosts` entry *is* the mechanism) and auto-opens `https://baseout.local:4331`
once the proxy is up (`BASEOUT_DEV_NO_OPEN=1` to skip).

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
local code in a Cloudflare edge sandbox accessed at `https://baseout.local:4331`.
Your local changes never affect any of the deployed URLs above until you
explicitly run a `deploy` command.

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
| Google "Access blocked: Authorization Error — Error 400: `invalid_request`" / "doesn't comply with Google's OAuth 2.0 policy" | **Different from `redirect_uri_mismatch`.** The `redirect_uri` host is `baseout.local` (or any non-public-suffix TLD). Google requires the host TLD be on the [public suffix list](https://publicsuffix.org/); `.local` is not, so Google rejects it outright. Caused by `PUBLIC_AUTH_BASE_URL=https://baseout.local:4331` in local dev (2026-06-03 migration, `60a9a01`/`c420667`). **Not fixable by registering a URI** — `.local` can't be registered (§3.2). | Decode the `redirect_uri=` in the URL bar; if the host is `baseout.local`, you're on the local origin — Drive Connect only runs on a deployed env ([§5.4](#54-drive-deployed-only-never-local)). |
| Microsoft redirects to `AADSTS50011: redirect_uri ... does not match` | Current env's URI isn't in [§3.5](#35-microsoft-onedrive-oauth-app-client_id72f34ac4-a827-4a86-949e-57ccb7154f7f) — or `MICROSOFT_REDIRECT_URI` in `.dev.vars` points to a host the Azure App hasn't registered yet | URL bar — decode the `redirect_uri=...` query param, compare against §3.5 + `apps/web/.dev.vars` |
| Microsoft `AADSTS70002` "must contain 'client_secret or client_assertion'" | App manifest has `allowPublicClient: false` — public-client mode disabled | [§4.5](#45-microsoft--onedrive-boss-owned-azure-portal--status-unknown) step "Allow public client flows = Yes" |
| Microsoft `AADSTS50020` / `AADSTS500113` on outlook.com / hotmail sign-in | App is registered for work/school accounts only — personal MSA rejected | [§4.5](#45-microsoft--onedrive-boss-owned-azure-portal--status-unknown) Supported account types = "any directory + personal MS accounts" |
| Microsoft `AADSTS50173` / `invalid_grant` on refresh after a quiet period | The stored refresh token was rotated by a prior refresh and our copy is stale — OR the user revoked at account.live.com/consent | If refresh-token rotation persistence regressed: check `apps/server/src/pages/api/internal/spaces/storage-destination.ts` onedrive block. Otherwise reconnect from `/integrations`. |
| Local `.dev.vars` change to `PUBLIC_AUTH_BASE_URL` has no effect | wrangler 4.x precedence: the `--var` flag assembled in `scripts/dev.mjs` wins | [apps/web/scripts/dev.mjs](../../apps/web/scripts/dev.mjs) |
| Magic-link sign-in at `https://localhost:4331` 403s with "Invalid origin" | Working as intended (2026-06-03). `localhost`/`127.0.0.1` were removed from `AUTH_BASE_URL.allowedHosts` and `DEV_TRUSTED_ORIGINS` in [apps/web/src/lib/auth-factory.ts](../../apps/web/src/lib/auth-factory.ts) — Better Auth refuses the Origin/Referer check, and the magic-link email URL is generated from the pinned `baseURL` (`https://baseout.local:4331`, §5.1), so login only ever completes on `baseout.local`. Browse `https://baseout.local:4331` instead. | [§5.5](#55-canonical-local-dev-url--trusted-cert-mkcert); [apps/web/src/lib/auth-factory.ts](../../apps/web/src/lib/auth-factory.ts) — `trustedOrigins` |
| Airtable Connect via baseout-dev works but local doesn't see the Connection | Stub mode is on locally — `AIRTABLE_STUBS_ENABLED=1` short-circuits the real DB read | [apps/web/.dev.vars](../../apps/web/.dev.vars) |
| Logged out after every browser refresh at `https://baseout.local:4331` OR OAuth Connect appears to succeed but no row is saved | Without a locally-trusted cert (`pnpm setup:certs`, §5.5), wrangler's fallback self-signed cert is for `localhost` only — Chromium-family browsers (incl. Brave) **special-case `localhost` as a Secure context even with a self-signed cert, but any other hostname is not**, so `Secure`-flagged cookies set under `baseout.local` get dropped between page loads AND during cross-site OAuth round-trips. Two cookie surfaces were affected: (1) better-auth's `__Secure-better-auth.session_token` → user logged out every refresh; (2) the per-provider OAuth handoff cookies (`bo_oauth_<provider>`) → callback hits `missing_handoff` and silently fails to persist the connection. Verified 2026-06-02: server-side signing + verification round-trip is healthy, the cookie just never comes back from the browser. Fixed by (a) `advanced.useSecureCookies: false` in better-auth when the resolved `baseURL` hostname is the canonical local-dev host `baseout.local` — derived via the shared `isLocalDevHost` helper (commit `1634819`; later narrowed from `{localhost, 127.0.0.1, baseout.local}` to `{baseout.local}` on 2026-06-03 — see [apps/web/src/lib/auth-factory.ts](../../apps/web/src/lib/auth-factory.ts)). A locally-trusted mkcert cert (§5.5) additionally makes `baseout.local` a real Secure context, so this is belt-and-suspenders; (b) a shared `shouldSetSecureOAuthCookie(request)` helper in [apps/web/src/lib/oauth/local-dev-secure.ts](../../apps/web/src/lib/oauth/local-dev-secure.ts) used by every OAuth `authorize` / `start` / `callback` handler in place of the inline `url.protocol === 'https:'` check. Production hosts (anything that isn't `baseout.local`) keep `Secure` cookies. Also added a visible alert in [StoragePicker.astro](../../apps/web/src/components/backups/StoragePicker.astro) for any `?storage_error=<code>` so a future failure isn't silent. | [apps/web/src/lib/auth-factory.ts](../../apps/web/src/lib/auth-factory.ts) `advanced.useSecureCookies`; [apps/web/src/lib/oauth/local-dev-secure.ts](../../apps/web/src/lib/oauth/local-dev-secure.ts) |
| OAuth Connect button bounces the user to `/login` on the same origin after authorize | Under `wrangler dev --remote`, the worker code's `url.origin` resolves to the deployed preview URL (e.g. `https://baseout-dev.openside.workers.dev`) even when the browser is at `https://baseout.local:4331`. The pre-fix start/authorize handlers used `getRedirectUri(url.origin)`, so the OAuth provider redirected the user to the deployed worker URL — the browser's session + handoff cookies (scoped to `baseout.local`) didn't follow, and the deployed worker's middleware bounced to `/login`. The cookie problem masqueraded as a session-persistence bug. Fixed 2026-06-02 by changing every provider's `start.ts` / `authorize.ts` to prefer `workerEnv.PUBLIC_AUTH_BASE_URL ?? url.origin` before calling `getRedirectUri`. Per-provider `*_REDIRECT_URI` overrides still win inside `getRedirectUri()` (kept for providers like OneDrive whose Azure-registered set doesn't include `baseout.local` yet). | The 5 provider handlers under [apps/web/src/pages/api/connections/](../../apps/web/src/pages/api/connections/); §5.1 above |
| OAuth provider callback (Airtable or any storage provider) returns `{"error":"Not authenticated"}` (HTTP 401) | Middleware is auth-gating the callback path. The OAuth callbacks (`/api/connections/airtable/callback` and `/api/connections/storage/<provider>/callback`) carry user identity via an **encrypted handoff cookie**, not via the better-auth session. They MUST be in `isPublicRoute` because browsers may not send the `SameSite=Lax` session cookie on the cross-site GET return from the OAuth provider (Brave's privacy shields are a known case of stricter-than-spec cross-site cookie behaviour — surfaced this 2026-06-01 after weeks of silent compounding with cron-side disconnects). Fixed in commit `4d2ddfc` by extending `isPublicRoute` with a `^\/api\/connections\/[^/]+(?:\/[^/]+)?\/callback$` regex. The `/start` route still requires a session (so attackers can't initiate Connect), the handoff cookie is signed with `BASEOUT_ENCRYPTION_KEY`, and the OAuth `state` param defends CSRF on the round-trip. Regression-tested in [apps/web/src/middleware.test.ts](../../apps/web/src/middleware.test.ts) — re-gating ANY of the five callback paths flips a pinned assertion. | [apps/web/src/middleware.ts](../../apps/web/src/middleware.ts) `isPublicRoute`; [apps/web/src/middleware.test.ts](../../apps/web/src/middleware.test.ts) for the contract |
| OAuth refresh cron flips Airtable Connection to Reconnect / Disconnected | **Status (2026-06-10): server cron reverted to pre-`994f5c6` behavior.** The `*/15` Airtable refresh cron repeatedly hit `cas_lost` after Airtable had already rotated the refresh token, leaving the DB with a stale grant and forcing Reconnect. Both `baseout-server-dev` and the non-env `baseout-server` were redeployed with no active cron trigger; `scheduled()` is the May 11 inert TODO stub. Next real fix: move Airtable refresh to a single on-demand owner (`/connections/:id/token` behind ConnectionDO/lock) with an opaque claim id instead of `modified_at` timestamp CAS. | [apps/server/wrangler.jsonc.example](../../apps/server/wrangler.jsonc.example), [apps/server/src/index.ts](../../apps/server/src/index.ts) |
| Airtable OAuth app still shows "connected" but Baseout `/integrations` shows Reconnect (`pending_reauth` or `invalid`) | After any `cas_lost`, the stored refresh token may be stale even if Airtable still lists the app authorization. Reconnect once after deploying the no-cron server, then verify no further `oauth_refresh_tick` logs appear. **Dev DB:** `node --env-file-if-exists=.env apps/web/scripts/diag-conns.mjs`. Do not run `diag-probe-airtable.mjs` on a row you intend to keep. | [apps/web/src/lib/airtable/persist.ts](../../apps/web/src/lib/airtable/persist.ts), [apps/web/scripts/diag-conns.mjs](../../apps/web/scripts/diag-conns.mjs) |
| Worried reconnect burns Airtable OAuth connection slots | **Baseout reconnect does not INSERT a new row** — [persist.ts](../../apps/web/src/lib/airtable/persist.ts) updates the existing `(organization_id, airtable)` connection in place (same `connections.id`). Reconnect only when the UI shows Reconnect; avoid repeated Connect clicks while debugging. **Airtable developer hub:** revoke duplicate "Baseout" authorizations for the same OAuth app if the hub lists multiples from earlier experiments. | [apps/web/src/lib/airtable/persist.ts](../../apps/web/src/lib/airtable/persist.ts) |

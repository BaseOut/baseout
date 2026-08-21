# web-settings — Promote the unified, catalog-driven Settings hub into the live app

## Status

IN PROGRESS → landing 2026-08-20 on `autumn/cursor-ui-implementation-test` (Phase 4 of
`web-cursor-ui-implementation`; does **not** merge `web-ui-sync-promotion`). Originally
PROPOSED 2026-08-13. Single-app (`apps/web`). A Stage-2/3 ui-sync promotion of
the design fork's redesigned Settings surface (`ui-only@7c7202d7` wiring; tip
`4073f919` noted in the ledger): the catalog-driven two-pane category hub
(`SettingsView` + `settingsCatalog` + `settingsControls`), reconciled onto apps/web's
REAL data and routes.

Relates to (cross-reference, does not duplicate):

- **`web-api-tokens`** — shipped the API-token CRUD (create/revoke, plaintext-once
  display) + the live `/api/tokens/*` routes on the pre-hub `pages/settings.astro`.
  This change LIFTS that section verbatim into the hub's Developer pane
  (`ApiTokensPanel`); the routes, the DOM ids, the plaintext-once modal and the
  token-hash-only storage are untouched. `web-api-tokens` tasks 2.x are updated,
  not duplicated.
- **`shared-ai-byok`** — shipped BYOK AI provider keys + `/api/ai-keys`. This
  change lifts `pages/settings/ai-keys.astro` into the hub's Developer pane
  (`AiKeysPanel`), wired to the same routes and the same `byo_ai_key` Plus+
  entitlement gate; `/settings/ai-keys` now redirects into the hub.
- **`server-retention-and-cleanup`** — owns the per-Space retention policy + its
  `PATCH /api/spaces/:id/retention-policy` route and the `/retention` page. This
  change links the Space category's "Data retention" row to that live page rather
  than reimplementing it.

## Why

apps/web ran several hand-built settings pages — `pages/settings.astro` (API
tokens + an "Account settings" blurb + an AI-keys link), `pages/settings/ai-keys.astro`,
and a separate `/retention` — with no shared shell. The design fork redesigned
Settings into a single catalog-driven hub: a left rail of seven categories
(Account · Security · Organization · Space · Billing · Notifications · Developer),
a settings-row pane, an inline commit-flash contract, a below-1280 drill-down, and
a D06 destructive-confirm. Promoting the fork's canonical hub keeps Settings from
drifting from the rest of the promoted app family (Sources/Destinations/Space-Home/
Backups/Auth) and gives the four already-built settings features one home.

## What Changes

- **`/settings` renders `SettingsView`** (the redesigned hub). `pages/settings.astro`
  becomes a thin SSR loader that resolves the subject + the two live sections' data
  and passes them in. The pre-hub page bodies are preserved as non-routing rollback
  views: `views/SettingsHub.legacy.astro`, `views/AiKeysView.legacy.astro`.
- **Four sections wired to REAL data + routes:**
  - **API tokens** (Developer pane) → `ApiTokensPanel`, live `POST /api/tokens` +
    `POST /api/tokens/[id]/revoke`; `apiTokens` table; hashes only, plaintext-once.
  - **AI keys** (Developer pane) → `AiKeysPanel`, live `/api/ai-keys` GET/POST/DELETE;
    `aiProviderKeys` table; `byo_ai_key` Plus+ entitlement gate (fail-closed);
    DISPLAY-only columns (never `key_enc`).
  - **Billing** → "Open portal" posts to the live `POST /api/billing/portal`
    (`setButtonLoading` spinner); "Usage this month" links to `/reports`.
  - **Space** → "Data retention" links to the live `/retention` page; "Backup
    schedule" → `/backups`; "Storage destination" → `/destinations`.
- **Honest gating of the not-yet-built remainder (in-code, never faked):** account
  name / profile picture / sessions / delete-account, org identity + audit log,
  space name/auto-add, billing email/invoices/overage, all notification prefs,
  webhook secret, SQL details, and the whole Security (2FA) category have no
  persistence route in apps/web yet. The catalog marks them `gated` — text renders
  read-only, select/toggle render disabled, so nothing flashes "Saved" without
  saving — and deferred actions print an honest note. The fork's fixture
  "Enrolled workspaces" block (which invented workspaces) is dropped.
- **`SecurityPanel` + `lib/auth/securityPanel.ts`** promoted (import chain resolved)
  but the Security category is gated off (no 2FA backend — deferred at the Auth
  promotion), so the pane shows an honest "coming soon" note.

## Non-goals

- No new backend: no user-profile / org-identity / space-rename / notification-prefs
  route is invented. Those sections are gated, not built.
- No change to the token / AI-key / retention / billing / usage routes or contracts.
- Full 2FA wiring for the Security pane (SecurityPanel backend) stays deferred.

## Security review points

- API-token storage unchanged: only `token_prefix` + `token_hash` persisted; the
  plaintext `bo_live_…` is injected client-side once and leaves the DOM with the
  modal (design D3). Revoke is owner/admin-only, org-scoped.
- AI-key plaintext stays WRITE-ONLY (sent once, cleared from the DOM after submit);
  SSR reads DISPLAY columns only; the `byo_ai_key` gate is fail-closed.
- Middleware auth on `/settings` unchanged; both panels' mutating buttons keep
  `setButtonLoading`, `finally`-cleared.
- Billing portal button posts to the existing route (Stripe hosted portal); no new
  secret or surface.

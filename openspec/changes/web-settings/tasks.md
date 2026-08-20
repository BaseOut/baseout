# web-settings — tasks

Stage-2/3 ui-sync promotion (SKILL.md): promote the fork's Settings hub, wire the
real sections, gate the rest honestly, preserve the replaced pages as legacy.

## 1. Promote the fork shell (Stage 2)

- [x] 1.1 `views/settingsCatalog.ts` — promoted; extended `SettingsRow` with `gated` / `href` / `action`; wired `build()` to real routes; dropped the fixture `dev-tokens` row + `ENROLLED_WORKSPACES`.
- [x] 1.2 `views/settingsControls.ts` — promoted; `ParentNode`/`Element` → `HTMLElement` (worker DOM-type-shadow); generic rows never fake a save (gated → disabled/readonly); added the real `billing-portal` button handler (`POST /api/billing/portal`, `setButtonLoading`).
- [x] 1.3 `views/SecurityPanel.astro` + `lib/auth/securityPanel.ts` — promoted verbatim (import rewrites; `ParentNode` → `Document | HTMLElement`). Gated off in the hub (no 2FA backend — deferred).
- [x] 1.4 `views/SettingsView.astro` — promoted; import rewrites; real-panel branches for Developer; `gated` rendering (readonly text / disabled select+toggle); real `href` links + `billing-portal` action; enrolled-workspaces block removed; honest Security note.

## 2. Wire the real sections (Stage 3)

- [x] 2.1 API tokens → `views/ApiTokensPanel.astro` (lifted from the pre-hub page): create form + list `table` + plaintext-once + revoke modals + script UNCHANGED; data via props; live `/api/tokens/*`. (Supersedes the pre-hub `web-api-tokens` §2.1–2.4 render location — see that change's tasks.)
- [x] 2.2 AI keys → `views/AiKeysPanel.astro` (lifted from `settings/ai-keys.astro`): provider cards + save/rotate/revoke + entitlement/role gate; DISPLAY columns only; live `/api/ai-keys`. Entitlement Alert links to `/settings?tab=billing`.
- [x] 2.3 `pages/settings.astro` — thin SSR loader: token query + mapping and the AI-key entitlement/query/provider-card assembly moved here verbatim; passes `tokens` + `aiKeys` + subject to `SettingsView`.
- [x] 2.4 `pages/settings/ai-keys.astro` — redirects to `/settings?tab=developer` (deep link preserved); body kept as `views/AiKeysView.legacy.astro`.
- [x] 2.5 Billing → real `POST /api/billing/portal` button; usage → `/reports`. Space → retention `/retention`, schedule `/backups`, destination `/destinations`.

## 3. Honest gating (no fake, never revive dead fork views)

- [x] 3.1 Every section with no apps/web persistence route is `gated` (readonly/disabled) or a deferred-action note — account profile/name/sessions/delete, org identity/audit, space name/auto-add, billing email/invoices/overage, notifications, webhook secret, SQL details, Security. Nothing flashes a save it cannot make.
- [x] 3.2 Fixture "Enrolled workspaces" block dropped (it invented workspaces).

## 4. Governance + verification

- [x] 4.1 `raw-markup-audit-allowlist.json` — entries for the 6 new views (SettingsView, SecurityPanel, ApiTokensPanel, AiKeysPanel, SettingsHub.legacy, AiKeysView.legacy). No new `components/` files → no story/classification churn.
- [x] 4.2 `views/settingsCatalog.test.ts` — unit tests for `buildCategories` identity/wiring/gating + `buildSettingsLinks` (fork shipped the latter untested).
- [x] 4.3 `shared/internal/ui-sync.md` §3 (ledger row) + §4 (promotion matrix row).
- [x] 4.4 Gates green: `audit:components`, `typecheck`, `test:unit`, `build`; new files console-clean.
- [ ] 4.5 Human smoke: `/settings` renders the hub on real data; Developer → create/revoke a token (copy plaintext) + add/rotate/revoke an AI key; Billing → Open portal reaches Stripe; Space → retention/schedule/destination links land; gated controls are visibly read-only/disabled; drill-down + theme at <375/<768/<1024.

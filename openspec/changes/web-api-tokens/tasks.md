# web-api-tokens — tasks

Schema note (§5.5): no migration in this change — `api_tokens` + migration `0027` shipped via `api-rest-read`. Verify `pnpm --filter @baseout/web db:check` is clean before smoking.

## 1. Routes (TDD — tests first, co-located `*.test.ts` per web CLAUDE.md §5.6)

- [x] 1.1 `src/pages/api/tokens/index.test.ts` — create: happy path (201, plaintext returned once, only hash+prefix persisted), name/scope/spaceId/expiry validation matrix (400s), member role 403, org resolved from session not body. → 20 tests, watched RED first.
- [x] 1.2 `src/pages/api/tokens/index.ts` — `POST` create handler: `getAccountContext` org + role gate, D7 validation, `generateApiToken()` from `@baseout/shared`, insert, `201 { token, row }`, `api_token.created` logger event. → also added `src/lib/log.ts` (web had NO structured logger — this is the §3.5-sanctioned utility, first consumer) + `@baseout/shared` workspace dep.
- [x] 1.3 `src/pages/api/tokens/[id]/revoke.test.ts` — revoke: happy path, idempotent re-revoke 200, foreign-org id 404, member 403. → 6 tests, watched RED first.
- [x] 1.4 `src/pages/api/tokens/[id]/revoke.ts` — `POST` revoke handler: org-scoped lookup, `is_active = false`, `api_token.revoked` logger event.
- [x] 1.5 CSRF: matched the house mutating-route convention exactly (session-cookie auth + JSON POST, as `/api/spaces` et al. — no per-request CSRF token exists anywhere in web today; the repo-wide Origin-check gap is comp-ai remediation P1, not this change). Auth/role gates asserted in tests.

## 2. Settings UI

> **Moved by `web-settings` (2026-08-20 on `autumn/cursor-ui-implementation-test`):** the API-tokens
> section below shipped on the pre-hub `pages/settings.astro`. The Settings-hub promotion lifted it
> VERBATIM into `apps/web/src/views/ApiTokensPanel.astro` (create form + list table + plaintext-once +
> revoke modals + client `<script>` unchanged; SSR query/mapping moved to the thin `pages/settings.astro`
> loader), mounted in the hub's Developer pane. The `/api/tokens/*` routes (§1) and the token-hash
> storage are untouched. Tasks 2.1–2.5 remain done — only the render location changed.

- [x] 2.1 SSR token list on `src/pages/settings.astro`: org-scoped query, "API tokens" `Card` section, `token_prefix` + ellipsis display, "All Spaces" label for NULL binding, revoke hidden for `member` role. → NOTE: this branch has no `.data-table` class or `StatusBadge` component — used the live house patterns instead: daisyUI `<table class="table text-sm">` (as BackupsListView/SpaceHomeView) + `Badge` (success/error/warning variants).
- [x] 2.2 Create form (name `TextInput`, `Checkbox` scope boxes defaulting to all three, Space `Select` from `account.spaces`, expiry preset `Select`) + submit via `setButtonLoading`, `finally`-cleared.
- [x] 2.3 Plaintext-once `Modal`: full token injected client-side only after the 201, copy-to-clipboard, "you won't see this again" warning; page reloads on close so the plaintext leaves the DOM with the modal.
- [x] 2.4 Revoke button with confirmation `Modal`, `setButtonLoading`, idempotent-safe (route returns 200 on re-revoke).
- [x] 2.5 Component governance: reused `Card`/`Badge`/`Button`/`TextInput`/`Select`/`Checkbox`/`Modal` as-is — zero new components or variants (coverage suite 38/38 green); table + scope-checkbox markup are existing documented daisyUI patterns.

## 3. Verification

- [x] 3.1 Targeted suites green (26/26 token routes; stories-coverage + classification 38/38); `typecheck` green (hints only, pre-existing). → `build` is env-blocked in the non-interactive session (wrangler remote-proxy auth error 10000 — the documented multi-account trap; fails identically at HEAD, before any compile step). Verify `pnpm --filter @baseout/web run build` from an interactive shell alongside the human smoke.
- [ ] 3.2 Human smoke: Settings → create token (copy plaintext) → `curl -H "Authorization: Bearer <token>" https://…/v1/orgs/{orgId}/spaces` succeeds → revoke → same curl returns 401 → re-open Settings, token shows revoked, plaintext nowhere retrievable. → API half VERIFIED 2026-07-24 without the UI: minted a `bo_live_` token + SHA-256 hash via the `@baseout/shared/api-tokens` scheme, inserted the row directly (org `e9ae1e3f…`, scopes `{org:read}`), local `apps/api` wrangler dev → `GET /v1/orgs/…/spaces` **200** with real data; `is_active=false` → same curl **401**; garbage token → **401**; smoke row deleted after. Note: `/v1/*` has NO deployed dev host (apps/api routes are deploy-blocked) — the curl target is local `pnpm --filter @baseout/api dev`. Remaining human half: Settings create/copy-plaintext/revoke UI + revoked badge.
- [ ] 3.3 Mobile pass at <375 / <768 / <1024 on the new Settings section.

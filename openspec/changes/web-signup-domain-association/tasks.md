# Tasks

## 1. Schema + resolution (TDD)

- [x] 1.1 Migration: `organization_domains` (org, domain, mode add|suppress) + join-request rows (requester, org, status, expiry, cool-down stamp). → `apps/web/drizzle/0031_signup_domain_association.sql` (also adds append-only `auth_audit_log`, consumed by web-auth-2fa + web-auth-airtable-sso); schema in `apps/web/src/db/schema/core.ts`; one open request per (org,user) via partial unique index. GENERATED, not applied (human applies at smoke time).
- [x] 1.2 Pure resolution module: derived ∪ added − suppressed − public denylist; denylist as maintained data, not code. → `src/lib/signup/domain-association.ts` (+ `.test.ts`, 10 tests) with denylist data in `src/lib/signup/public-email-domains.ts`; multi-org match capped at 3 (design open Q1 default).

## 2. Fork + lifecycle (TDD — auth-adjacent, §3.4 mandatory)

- [x] 2.1 Fork hook at the single account-creation point (post-verification), wired for magic-link signup. → `databaseHooks.user.create.after` in `auth-factory.ts` (fires for every better-auth user creation — magic link AND SSO) → `src/lib/signup/account-created.ts` (audit row `signup_domain_matched`, never blocks); fork data served by `GET /api/onboarding/domain-association` (onboarding-gate-exempt so /welcome can offer join-or-create). Fork SCREEN itself lives in ui-only `login-methods` (out of scope here).
- [x] 2.2 SSO no-match branch delegates here (coordinate with `web-auth-airtable-sso` task 2.2). → structural: SSO user creation flows through the SAME `databaseHooks.user.create.after` hook and the /welcome onboarding fork endpoints as magic link — nothing method-specific to wire (see web-auth-airtable-sso task 2.2 annotation).
- [x] 2.3 Join-request create/notify; admin approve/decline routes (middleware-gated); expiry + decline cool-down; membership creation on approval; audit rows throughout. → lifecycle in `src/lib/signup/join-requests.ts` (pure `evaluateCreateRequest`/`evaluateDecision` + db wrappers; 7d expiry lazily applied, 30d decline cool-down); routes `POST /api/onboarding/join-request`, `GET /api/organizations/join-requests`, `POST /api/organizations/join-requests/[requestId]`; admin/requester emails via `src/lib/email/templates/join-request.ts`; membership via the organization_members insert shape (role 'member', onConflictDoNothing); audit rows on create/approve/decline/expire.

## 3. Verification

- [x] 3.1 Vitest on resolution + lifecycle; integration on routes; `typecheck`/`build` green. → 35 tests green (`npx vitest run src/lib/signup src/pages/api/onboarding src/pages/api/organizations`); route handlers tested via the injected-deps pattern (rescan-bases style) rather than live-PG integration. `astro check`: no NEW errors (6 pre-existing errors in tests/integration/airtable-persist.test.ts — `refreshExpiresIn` — predate this change).
- [ ] 3.2 E2E: magic-link known-domain fork; approval → membership. Cross-check screen states with ui-only `login-methods`. → NOT DONE: fork/pending-banner screens live in ui-only `login-methods` (out of scope this pass); E2E deferred until those screens promote. Server flow smokeable via the three API routes.

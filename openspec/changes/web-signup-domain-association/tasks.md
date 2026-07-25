# Tasks

## 1. Schema + resolution (TDD)

- [ ] 1.1 Migration: `organization_domains` (org, domain, mode add|suppress) + join-request rows (requester, org, status, expiry, cool-down stamp).
- [ ] 1.2 Pure resolution module: derived ∪ added − suppressed − public denylist; denylist as maintained data, not code.

## 2. Fork + lifecycle (TDD — auth-adjacent, §3.4 mandatory)

- [ ] 2.1 Fork hook at the single account-creation point (post-verification), wired for magic-link signup.
- [ ] 2.2 SSO no-match branch delegates here (coordinate with `web-auth-airtable-sso` task 2.2).
- [ ] 2.3 Join-request create/notify; admin approve/decline routes (middleware-gated); expiry + decline cool-down; membership creation on approval; audit rows throughout.

## 3. Verification

- [ ] 3.1 Vitest on resolution + lifecycle; integration on routes; `typecheck`/`build` green.
- [ ] 3.2 E2E: magic-link known-domain fork; approval → membership. Cross-check screen states with ui-only `login-methods`.

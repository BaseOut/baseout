## Status

Not started — **blocked on product auth live in production** (better-auth on the
production domain). Filed for sequencing per ui-only
[`support-portal`](../../../../ui-only/openspec/changes/support-portal/)'s deferred
pairing. Web surface + contract only; the support Worker side lands in the
support app.

---

## 1. Session bridge (tests first)

- [ ] 1.1 Pure code lifecycle module: mint (random 256-bit, hash-at-rest, audience `support`, 60s TTL) / validate (unexpired, unused, audience match) / consume (single-use mark). Unit tests: happy path, expiry, replay, wrong audience.
- [ ] 1.2 Migration: `support_handoff_codes` (code_hash, user_id, audience, expires_at, used_at).
- [ ] 1.3 `GET /api/support/handoff?returnTo=` — session present → mint + 302 to `<support origin>/auth/callback?code=…`; no session → `/login?returnTo=` reusing the admin bridge's validated-returnTo path (extend the allow-list to the support origin; consult oauth-setup.md §5 first, update it same-change). Route tests: redirect shapes, invalid returnTo rejected.
- [ ] 1.4 `POST /api/support/exchange` — `x-support-bridge-token` gate (`SUPPORT_BRIDGE_TOKEN` via `.dev.vars` + secret-bulk deploy discipline), code consume, returns `{userId, email, name}` only. Route tests: bad secret 401, replayed/expired 410, happy path never includes a session token.

## 2. Ticket storage + API (tests first)

- [ ] 2.1 Migrations: `support_tickets` + `support_ticket_messages` (Organization-scoped, status `open|pending|closed`, audit timestamps). `pnpm --filter @baseout/web db:check` clean.
- [ ] 2.2 Pure scoping module: ticket visibility/mutation decisions (user → Organization membership; staff bypass). Unit tests incl. cross-Organization denial.
- [ ] 2.3 Bridge-gated routes: `GET/POST /api/support/tickets`, `GET /api/support/tickets/:id`, `POST /api/support/tickets/:id/messages` — secret gate + acting-user re-validation + server-side subject/body validation (plain text). Route tests: scoping, validation 400s, secret gate.
- [ ] 2.4 Customer notification on staff reply via the existing transactional email rail (link to the support portal thread) — reuse, no new email surface.

## 3. Staff visibility

- [ ] 3.1 `/ops/tickets` list + thread + staff reply (existing `users.role='super'` gate; `.data-table` + StatusBadge patterns). Tests on the authz gate + reply path.

## 4. Contract handoff

- [ ] 4.1 Document the support-Worker contract (callback param, exchange request/response, ticket API shapes, error codes) in this change's design.md §Chosen mechanism + a pointer from the ui-only `support-portal` change when it graduates. Cross-app touches, if any emerge, re-scope this change to `shared-*` per §3.6.

## 5. Verification

- [ ] 5.1 web `typecheck` + `build` green; new unit + route suites green; no stray `console.*`; security checklist from proposal.md Impact walked (new secret, new auth path, returnTo validation, scoping).
- [ ] 5.2 Human smoke (deployed, post-auth-live): signed-in app user → support portal "Sign in" → lands back signed-in without re-entering credentials → opens a ticket → staff replies from `/ops/tickets` → customer sees the reply + receives the email. Replayed exchange code fails.

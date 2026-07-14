# web-support-bridge — Design

## Why not the admin pattern

`apps/admin` reads web's `better-auth.session_token` cookie directly — that works because dev admin shares the host (`baseout.local`, ports differ, cookies ignore ports). support.baseout.com is a **different registrable host** in production: the app cookie is host-scoped and won't be presented there. Widening the cookie to `Domain=.baseout.com` was rejected — it hands the product session to every present and future subdomain (marketing, status, survey), the opposite of least privilege, and re-opens the Secure-cookie/host pitfalls already documented in the runbooks.

## Chosen mechanism: one-time-code handoff + server-to-server exchange

1. **Handoff (user-visible)** — support's "Sign in" sends the browser to web's `GET /api/support/handoff?returnTo=<support origin>`. Web middleware sees its own session (or routes through `/login?returnTo=…` exactly like the admin bridge — reuse that validated-returnTo code path, don't fork it). With a session, web mints a **one-time code**: random 256-bit value, stored server-side (row: code hash, user id, audience `support`, expiry now+60s, used_at null), then 302 to `<support origin>/auth/callback?code=…`.
2. **Exchange (server-to-server)** — the support Worker POSTs web's `POST /api/support/exchange` with `{code}` and header `x-support-bridge-token: SUPPORT_BRIDGE_TOKEN` (same defense-in-depth stance as the engine's `INTERNAL_TOKEN`). Web validates the secret, looks up the code hash, checks unexpired + unused, marks used, and returns `{userId, email, name}` — **never the app session token**.
3. **Support session** — the support Worker sets its own cookie on its own domain (its concern, documented in the contract section of the ui-only change). TTL short (e.g. 24h); expiry re-runs the handoff, which is silent when the app session is alive.

Properties: no app cookie crosses domains; no long-lived bearer travels through the URL (the code is single-use, 60s, audience-bound, stored hashed); app-side logout converges within the support-session TTL; the exchange endpoint is useless without the shared secret even if a code leaks.

## Ticket storage & API

- **Tables (canonical, web migrations)**: `support_tickets` (id, organization_id, opened_by_user_id, subject, status `open|pending|closed`, created_at, updated_at) + `support_ticket_messages` (id, ticket_id, author kind `customer|staff`, author_user_id, body, created_at). Names via Features §1 dictionary; no engine mirror needed — the engine never reads these.
- **API (bridge-gated, called by the support Worker)**: `GET/POST /api/support/tickets`, `GET /api/support/tickets/:id`, `POST /api/support/tickets/:id/messages`. Every call carries the bridge secret + the acting `userId` the Worker verified at exchange time; web re-validates the user exists and scopes reads/writes to their Organization membership. Server-side validation on subject/body; no HTML pass-through (Astro auto-escaping on render, plain text stored).
- **Staff side**: `/ops/tickets` (existing `users.role = 'super'` gate) — list, thread, reply (author kind `staff`). Replies notify the customer via the existing transactional email rail (link back to the support portal), reusing the notification path — no new email surface.

## Sequencing & blockers

- **Hard blocker**: production auth live (better-auth on the production domain) — the handoff has nothing to verify until then.
- Support Worker side (callback route, session cookie, ticket UI wiring) belongs to ui-only `support-portal` / its monorepo graduation — this change owns only the web surface + contract.
- Chat-limit/engine work explicitly out of scope (deferred by the support-portal change itself).

## Testing

Pure modules first (§3.4): code mint/validate lifecycle (hash, expiry, single-use), returnTo validation reuse, ticket scoping decisions — unit-tested without HTTP. Route integration tests: handoff redirects (session / no-session), exchange (bad secret 401, replayed code 410, expired code 410, happy path shape), ticket CRUD scoping (cross-Organization access denied).

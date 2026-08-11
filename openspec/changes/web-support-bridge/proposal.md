## Why

The support portal (ui-only [`support-portal`](../../../../ui-only/openspec/changes/support-portal/): `apps/support`, a Starlight site at support.baseout.com with Docs · Chat · Tickets · Roadmap) ships its docs and roadmap standalone — but **Tickets requires knowing who the customer is**, and the support app deliberately runs no auth of its own. Its proposal defers exactly this to "a monorepo change for the auth bridge (session verification from support.baseout.com against the Baseout app) + ticket storage." This is that change: the web-side session bridge and the canonical ticket storage + API. Until it lands, the support portal's Tickets surface shows its signed-out state.

**Blocked on product auth being live in production** (better-auth on the production domain). Filed now for sequencing; implementation waits for that gate.

## What Changes

- **Cross-domain session bridge**: support.baseout.com cannot read the app's session cookie (host-scoped; and per §3.3 a spoofable header is never acceptable). The bridge is a one-time-code handoff — support redirects to a web handoff route; web, seeing its own session, issues a short-lived one-time code; the support Worker exchanges the code **server-to-server** (shared-secret gated, `INTERNAL_TOKEN`-pattern) for the verified identity and sets its own session on its own domain. Details in [design.md](design.md).
- **Session introspection + revocation awareness**: the exchange endpoint returns the minimal identity (user id, email, display name) — never the app session token itself; support sessions are bounded (short TTL, re-handoff on expiry) so app-side logout/revocation converges.
- **Ticket storage (canonical, web-owned)**: master-DB migrations for `support_tickets` + `support_ticket_messages` (Organization-scoped, status lifecycle, audit timestamps).
- **Ticket API**: web routes the support Worker calls server-to-server (bridge-secret gated, acting-user asserted from a verified support session): list my tickets, create ticket, read thread, append message. Server-side validation on every mutation; tickets scoped to the requesting user's Organization membership.
- **Staff visibility**: tickets surface for staff in the existing `/ops` console (list + thread + reply as staff) — minimal read/reply, not a full helpdesk.

## Capabilities

### New Capabilities
- `support-bridge`: cross-domain session handoff (one-time code + server-to-server exchange) letting support.baseout.com verify a Baseout login without reading app cookies or receiving app session tokens.
- `support-tickets-store`: canonical ticket + message storage in the master DB with a bridge-gated CRUD API and `/ops` staff visibility.

### Modified Capabilities
<!-- No product-app UI change; /login returnTo validation extends to the support handoff route. -->

## Impact

- `apps/web` only: handoff + exchange + ticket API routes, canonical migrations, a new `SUPPORT_BRIDGE_TOKEN` secret (`.dev.vars` source-of-truth discipline per §3.3), `/ops` tickets surface. If design lands on a separate Worker surface instead, re-scope to `shared-*` per §3.6 — flagged, not expected.
- **Consumer**: the support Worker (ui-only `apps/support`, graduating to the monorepo later) — its exchange calls and ticket calls are its side; contract documented here, implemented there.
- **Security review points** (§3.3): new secret (`SUPPORT_BRIDGE_TOKEN`), new auth path (one-time code — single-use, short TTL, audience-bound), new public surface (handoff route — same returnTo-validation rigor as the admin login bridge), ticket mutations validated + Organization-scoped, no app session token ever leaves the app.
- **Pairs with**: ui-only [`support-portal`](../../../../ui-only/openspec/changes/support-portal/) (its `support-tickets` capability consumes this).
- **Consult first**: [shared/internal/oauth-setup.md](../../../shared/internal/oauth-setup.md) §5 (returnTo/base-URL resolution) before touching the handoff routing; update it in the same change if the handoff adds an auth-gated path.

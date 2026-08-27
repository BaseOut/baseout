# Execution plans — Astro 7 upgrade + support-site backends (2026-08-27)

Two queued work streams, planned to be startable on a word. ui-only pull note: the fork delta
since the final support sync (`af6d4b27..cd276b9c`) is one survey research doc — survey is out of
scope (2026-08-19 ruling), nothing synced, nothing owed.

---

## Stream A — Astro 6→7 (`openspec/changes/system-astro-7-upgrade`, tasks are the plan)

**Why now-ish:** it is the ENTIRE remaining dependabot backlog (17 alerts after the website
archive). Independent of Dan's account split — it never touches wrangler env config.

- **Order:** recon (official v7 upgrade guide via ctx7 — task 1.1) → support → admin → design →
  web. One commit + full gates per app, so a failure strands one app, not the train.
- **Budget:** support ~1h; admin ~1h; design ~2h (Storybook Container API is the risk); web a
  half-day (adapter/DO re-exports, middleware tree-shaking, stories-coverage, E2E) + human smoke.
- **Sequencing vs Stream B:** run Stream A FIRST. Phase B1 below adds server code to apps/support
  via the Astro adapter — building that on 6 and migrating it a week later is double work.
- **Needs from a human:** a go signal; the web smoke at the end (login + Backups poll).

## Stream B — Support-site backends (fixture front → real product)

**The architectural fact everything hangs on:** `baseout-support` deploys as static assets only —
no worker script, no server routes. The contact form, votes, feedback, and chat budget are
browser-local by construction. Every phase below starts from giving the app a server half:
**`@astrojs/cloudflare` adapter with the site kept prerendered** (pages stay static files; only
`/api/*` routes run server-side). Matches the existing web/admin stack; no second pattern.

### B0 — Server half + D1/KV provisioning (support-portal tasks 2.1/2.2) — READY NOW
Adapter + `SUPPORT_DB` (D1) + `CHAT_LIMITS` (KV) declared in wrangler.jsonc (bindings in the
FILE, per Dan's rule; resources created in the CURRENT account — support is production, the
account split moves dev/staging, not this). First consumers: roadmap votes + page feedback
become real (their UI already exists; D1 vote/feedback tables + two POST routes). ~half a day.
R2/D1/KV are sanctioned (Dan, 2026-08-24).

### B1 — Ticket intake, email-first (fork design `support-ticket-portal`; Dan's boundary:
"a ticket is answered by a person, by email")
- `/api/contact` route: validate, write the case row (D1), send the acknowledgement email —
  **the MJML templates already exist in the app** (`emails/acknowledgement*`), built for exactly
  this. The receipt state ("case number + the address the reply goes to") is designed.
- Needs ONE infra decision from Dan: the outbound from-address for support
  (product uses `mail.baseout.dev`; reuse the same Email Sending config or a
  `support@baseout.com` route). Anonymous-friendly: no auth required, per the fork's ruling
  (anonymous submitters get email, not a portal view).
- ~1 day once the from-address exists.

### B2 — The reply loop (person answers by replying to the email)
Cloudflare Email Routing → support worker: inbound replies thread onto the case (D1), customer
gets the reply email (`emails/reply*` templates exist). This is the piece that makes tickets a
conversation instead of a message in a bottle. Needs MX/routing setup on the domain (Dan's zone,
but wrangler-declarable email handlers). ~1–2 days including the threading edge cases.

### B3 — Signed-in portal mirror (`/requests`) — auth bridge
`web-support-bridge` is FILED and its stated blocker ("product auth live in production") has
LIFTED — prod login works as of 2026-08-27. Design choice to settle in that change:
`console.baseout.com` and `support.baseout.com` share the registrable domain, so a
`Domain=.baseout.com` session-read may work directly (unlike admin's workers.dev/PSL problem);
fall back to the admin-style 60s handoff token if cookie scoping is rejected. The `/requests`
list + thread UI is already built on fixtures — this phase swaps the data source only.

### B4 — Chat engine (docs-grounded answers)
Retrieval exists (Pagefind index; the drawer already cites real hits). Missing: the answer model
+ the KV budget enforcement ("anonymous visitors get N free messages, then sign in").
**Dan decision required: which model pays for this** (precedent: Schema Chat was ruled paid-model,
not free Workers AI). Deliberately last — every earlier phase ships value without it.

### Blockers ledger (Stream B)
| phase | blocked on |
|---|---|
| B0 | nothing |
| B1 | from-address decision (Dan) |
| B2 | Email Routing on the zone (Dan's DNS; config itself is ours) |
| B3 | nothing hard — design choice inside web-support-bridge |
| B4 | model/budget decision (Dan) |

**Recommended order:** Stream A entirely, then B0 → B1 → B3 → B2 → B4 (B3 before B2 because the
portal mirror multiplies the value of every reply threaded by B2).

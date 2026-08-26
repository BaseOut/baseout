# support-portal — Design

## Starlight is the frame; everything else is a custom page

Docs are pure Starlight for CONTENT (content collections, sidebar, dark/light). Tickets and Roadmap
are custom routes rendered inside the same shell so the portal feels like one site.

**Revised 2026-08-19.** This section used to end "custom pages keep Starlight's header/theme; no
second design system", which contradicted Oleh's ruling that the portal is built from Baseout's own
elements — and is now simply not what the code does. Starlight is the FRAME, not the finish:

- The brand bridge (`brand/baseout-bridge.css`) maps every `--sl-*` onto Baseout tokens, and
  `apps/support/src/styles/support.css` carries the portal's own rules on top of it.
- Four of Starlight's components are replaced through its documented `components: {}` option —
  `Banner` (mounts the chat dock on every page), `Hero` (the landing band), `Search` (our ⌘K modal
  in place of the Pagefind UI) and `PageSidebar` (the contents card that folds into a button).
- Pagefind is still the index; only its UI is ours.

There is still no SECOND design system: everything above is drawn from the same Baseout tokens as
the product. What changed is the reading of "custom" — Starlight was never the constraint that
sentence assumed. Dan confirmed the same conclusion independently on 2026-08-18, after reading
Starlight's own docs: *"we can create our fully custom React components… this works."*

## Chat: ship the shell, defer the engine

- UI: single-thread conversation (no thread management v1), composer, message list, "answers come from our docs" framing, source links under answers (once the engine exists).
- **Budget affordance**: N free messages per anonymous session (tracked in KV keyed on a session cookie + IP hash; exact N configurable). Hitting the budget swaps the composer for "Sign in to Baseout to keep chatting" (deep-link to the app's login with returnTo).
- Stub responder in this change echoes a canned "docs are coming" answer so the flow is walkable.
- Engine options (decide later, separate change): docs-corpus RAG on Workers AI / a hosted assistant behind a proxy / the product's chat plumbing repointed. Whatever lands must enforce the budget server-side — the KV check in the page is UX, not security.

## Tickets: hard requirement on real auth

- Auth = Baseout app session (support is a sibling origin; the bridge is server-side session verification against the app — same shape as the admin console's interim auth: read-only session check, no local login, no session minting).
- Until the bridge ships (monorepo change), `/tickets` renders the signed-out state with "Sign in at app.baseout.com". No fake ticket creation.
- Data model (when live): ticket (id, org/user refs, subject, status open|pending|closed), messages thread; storage decision (D1 local vs product DB) belongs to the paired monorepo change — the UI contract here is list/create/thread only.

## Roadmap + voting

- Columns Planned / In progress / Shipped; card = title, one-paragraph description, vote count, vote button (Shipped cards don't vote).
- **Votes in the support app's own D1**: `features` (slug, title, body, status, sort) seeded via migration; `votes` (feature_slug, voter_hash, created_at, unique(feature_slug, voter_hash)). `voter_hash` = HMAC of (cookie id + IP) — best-effort dedupe, explicitly not fraud-proof.
- Feature list is content-managed by editing the seed/D1 for now; an admin surface is a non-goal.
- Signed-in voting (attributing votes to customers) upgrades later via the same auth bridge as tickets.

## Bindings & envs

`wrangler.jsonc` declares D1 (`support_db`) + KV (`chat_limits`) — commented until provisioned so a fresh clone deploys the static site without bindings. Local dev: fixture data for roadmap; chat stub needs nothing.

## Non-goals (v1)

Multi-language docs, docs versioning, SLAs/priority on tickets, email notifications on ticket replies (comes with the monorepo pairing), an admin UI for roadmap/tickets.

## Backend handoff — what the forms and the board actually need

**Moved here from the pages themselves on 2026-08-19.** `/contact` carried a paragraph headed *For
the engineer* and `/roadmap` one headed *Not backed by a store yet*, both naming source files. They
were written for whoever wires the backend and were being read by whoever came to report a failed
backup. A note addressed to a developer does not belong in a production interface — the honesty it
was carrying (*"nothing was sent"*, *"counts are not shown yet"*) stays on the pages in the user's
own terms, and the requirements live here.

### A ticket (`/contact`, "something is broken")

- A row keyed by **email**, carrying an `unauthenticated` flag — the person is not signed in and the
  record has to say so rather than implying an account.
- An email to the submitter, so the address is the place the case lives until sign-in exists.
- A route into the **same queue** signed-in tickets use. One queue, two ways in.
- Rate limiting. An unauthenticated form on a public site is a spam target on day one.

### A request (`/contact`, "something I wish existed")

- A row with status `Planned` by default, held for **moderation** before it appears on the board.
- The submitter's email **stored and never exposed** — it is the vote identity, not a byline.
- The same rate limiting.

### Votes (`/roadmap`)

- `VOTES_LIVE` in `src/lib/votes.ts` gates the count over fixture numbers and **flips in the same
  commit as the endpoint**. Publishing invented counts under a line that calls them illustrative is
  not the same act as publishing real ones.
- One vote per email per request; the address is never rendered.
- A status change should be able to reach everyone who voted — that return channel is the reason
  the address is collected at all.

The shapes these must fill are the typed fixtures in `src/data/requests.ts`; its header is the
field-by-field note.

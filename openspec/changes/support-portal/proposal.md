## Why

Baseout needs a support environment before customers arrive: product documentation, a way to ask questions (chat), a way to escalate (tickets), and a public voice in the roadmap. None of that belongs inside the product app — it's a separate public property (support.baseout.com) that must work for logged-out visitors and get better for logged-in customers.

## What Changes

- **New app `apps/support`**: an Astro site built on **Starlight** (Astro's documentation framework), deployed to Cloudflare Workers.
- **Four surfaces**:
  1. **Docs** — Starlight-native documentation (getting started, guides per product area, FAQ, troubleshooting). Search included via Starlight's built-in Pagefind.
  2. **Chat** — a support chatbot answering from the docs corpus. **Anonymous visitors get a limited number of free messages** (per-session/IP budget); beyond that, signing in to the Baseout app is required. Engine + limit mechanics are deliberately deferred ("worry about that later") — this change ships the chat UI shell, the limit affordance ("Sign in to keep chatting"), and a stubbed responder.
  3. **Tickets** — a help-ticketing surface for **logged-in customers** (auth = the Baseout app's session; the cross-domain auth bridge is a paired backend change in the monorepo, deferred until Baseout auth is live). Ticket list, create, thread view. Until the auth bridge exists, the page shows the signed-out state.
  4. **Roadmap** — public roadmap of coming features with **voting**: columns (Planned / In progress / Shipped), feature cards, one vote per visitor per feature (anonymous votes allowed, deduped best-effort; votes stored in the app's own **Cloudflare D1**).
- **Persistence stance** (per the standing decision for these public apps): the support Worker owns lightweight storage — D1 for roadmap features + votes and (later) ticket metadata cache; chat limits in KV. No dependency on the monorepo to launch docs + roadmap.
- **Scaffold in this change**: Starlight app with seed docs (index, getting started, FAQ stub), custom pages for `/roadmap` (working local UI over fixture data, D1 wiring stubbed), `/chat` (UI shell + stub responder + limit affordance), `/tickets` (signed-out state), wrangler config with D1/KV bindings declared but commented until provisioned.

## Capabilities

### New Capabilities
- `support-docs`: Starlight documentation site with search.
- `support-chat`: doc-grounded chatbot with anonymous message budget and sign-in gate (engine deferred).
- `support-tickets`: customer ticketing gated on Baseout login (auth bridge deferred; paired monorepo change to be filed).
- `support-roadmap`: public roadmap with per-feature voting backed by the app's own D1.

## Impact

- New workspace app `apps/support` (`@baseout/support`); no changes to `apps/web` / `apps/design`.
- **Deferred pairings**: a monorepo change for the auth bridge (session verification from support.baseout.com against the Baseout app) + ticket storage; a chat-engine change (corpus indexing + model calls + hard limits) once the chat approach is chosen.
- **Graduation note**: starts here, expected to migrate to the monorepo `apps/*` once stable — ticketing in particular cannot ship before then.
- Security: anonymous-vote dedupe is best-effort (cookie + IP hash), not a trust boundary; no PII stored for anonymous visitors; ticket auth is real session verification, never a spoofable header.

## What was removed on 2026-08-25, and what to do if you want it back

Four research documents were deleted from this change: `research-chat.md`, `research-docs.md`,
`research-ds-bridge.md` and `research-requests-2026-08-19.md`, 127 KB between them. They were the
working notes behind decisions that have since shipped, and **nothing in the tree cited any of them** —
checked with `git grep` before removing, one file at a time.

**Eight research documents stayed**, and the reason is the same test read the other way: five are cited
from live source (`astro.config.mjs`, `markdoc.config.mjs`, `lib/landing.ts`, `data/requests.ts`,
`pages/contact.astro`, `lib/votes.ts`), two are cited from `support-ticket-portal/design.md`, and
`research-multi-platform-2026-08-20.md` is named as the companion of a surviving file. A developer
following a citation out of the code has to land on something.

**Nothing was destroyed.** They are in the history at the commit before this one. If you want one back,
`git log --diff-filter=D -- openspec/changes/support-portal/` names the commit and `git show` prints it.


# support — Proposal

**App umbrella change** for `apps/support` (§3.6: an app's parent change is the bare app name).

## Why

`/help` in apps/web is a card that says *"In-app chat support is coming soon"* over a `mailto:` link. The sidebar's **Help Center** entry points at it. Eleven other copy strings across the product instruct the user to contact a support channel that the product cannot name — the audit files this as `S32-F2`, "the support dead end", and its interim ruling was *retarget the CTAs and delete the placeholder rather than build a page around an unknown*.

The fork has now built the thing those CTAs should point at. `ui-only@252005be`'s 22-commit delta is almost entirely a net-new **`apps/support`** — a public support portal at `support.baseout.com`: documentation, an assistant that answers from those documents, a ticket door that needs no account, and a public request board with voting. 99 files, and the delta's commits are refinement rather than exploration (the landing variants cut so each pair differs by exactly one thing; the docs section reordered so someone reporting a failure does not scroll past forty pages about backups; the request board's search stopped requiring every word at once).

This change stands that app up in the monorepo.

## ⚠️ Blocked on client question #6 — and the blocker is a product question, not a design one

`apps/design/audit/CLIENT-QUESTIONS-PENDING.md` #6: **"Does a support channel exist at all — an address, a status page, a docs host?"** It has **never been put to Dan**. The audit is explicit that this must not be phrased as a design question: *"The blocker is not 'what should Help look like' — it is 'is there anything to point at'."*

What that gates, precisely:

| gated on #6 | not gated |
|---|---|
| the DNS name + hosting decision (`support.baseout.com` vs `.dev` — the fork's own files disagree) | the docs content and IA |
| whether **tickets** have a human on the other end | the roadmap board + voting |
| whether a **status page** exists to link | the chat UI shell + doc-grounded answering |
| retargeting apps/web's eleven support CTAs | the brand bridge + Starlight shell |

So Phases 1–4 below build and are verifiable locally; **Phase 5 (go-live: DNS, the eleven CTA retargets, deleting `/help`) does not start until #6 is answered.** Nothing in 1–4 becomes wasted work under any answer — the worst case is that tickets ship signed-out-only for longer.

## ⚠️ Governance exception — this app cannot follow the two-tier UI rule

CLAUDE.md §4.2 and the two-tier governance (`audit:components`) bind **apps/web**: Storybook-cataloged component first, daisyUI second, never a custom wrapper. **`apps/support` is a Starlight site, and Starlight's extension mechanism *is* component overrides.** The fork overrides eight Starlight slots (`Header`, `SiteTitle`, `Hero`, `Search`, `PageSidebar`, `Footer`, `Banner`, plus its own landing/board components) because Starlight's grid cannot express the layout otherwise — its first column is sized to the docs sidebar.

The reconciliation, and it needs sign-off rather than assumption:

- **apps/support is OUT of the `audit:components` gate** (it already is — the gate scopes to apps/web) and does not get Storybook entries.
- **Visual consistency comes from `brand/baseout-bridge.css` instead** — one 342-line sheet mapping Starlight's `--sl-*` surface onto Baseout tokens, shared by the public apps. The fork's own header on that file warns it must **never** be pointed at `apps/web/src/styles/global.css` (~3,300 mostly-unlayered lines would out-rank Starlight's reset, prose styles and layout at once).
- **No apps/web component is copied into apps/support and no support component is copied back.** The bridge is the only shared artifact.

If that exception is not acceptable, the alternative is not "make Starlight use daisyUI" — it is "don't use Starlight", which is a re-design of a settled 99-file surface. Flagging rather than deciding.

## What Changes

- **New workspace app `apps/support`** (`@baseout/support`), Astro `^6.1.2` + `@astrojs/starlight@^0.40.0`, dev port **4342**, deployed to Cloudflare Workers. Astro version matches an app already in the tree, so no `minimumReleaseAge` / astro-pairing risk (`ui-sync.md` §5).
- **`brand/baseout-bridge.css`** — the shared public-app brand sheet, promoted verbatim.
- **Four surfaces**, per the fork:
  1. **Docs** — Starlight content collection, IA organised by *what the reader is trying to do* (back something up · get it back · look inside it · something is wrong), which is why Sources and Destinations share a section though the app lists them apart. Search via Starlight's Pagefind. Per-page feedback ("was this useful") because a page that is read has no way to say it failed.
  2. **Chat / Ask AI** — one home, in the header beside docs search (asking is the same job as searching, one step further along). Anonymous message budget → sign-in gate. **Responder stubbed in this change**; the engine is a deferred pairing.
  3. **Contact** — the single ticket door. `/submit` and `/tickets` both redirect here (a portal that 404s a URL it published is one people stop linking to, and `/tickets` is where the chat's out-of-messages line pointed).
  4. **Roadmap** — public request board, Planned / In progress / Shipped, one vote per visitor per request, duplicate-finding search.
- **Persistence**: the support Worker owns its own lightweight storage — **D1** for requests + votes, **KV** for chat budgets. **No dependency on the monorepo master DB**, so docs + roadmap can launch before anything else does.
- **Deferred pairings, filed not built**: the cross-domain **auth bridge** (verifying an apps/web session from `support.baseout.com`, so tickets can be per-customer) and the **chat engine** (corpus indexing + model calls + hard limits). Until the bridge exists, Contact is the account-free door and that is a complete product, not a stub.

## Capabilities

### New Capabilities

- `support-docs`: public documentation with search, job-organised IA, and per-page feedback.
- `support-chat`: doc-grounded assistant with an anonymous message budget and a sign-in gate; responder stubbed pending the engine pairing.
- `support-requests`: public request board with per-visitor voting and duplicate-finding search, over the app's own D1.
- `support-contact`: account-free ticket door; the single destination for `/submit` and `/tickets`.

### Modified Capabilities

None in this change. **Phase 5** modifies apps/web (retarget eleven CTAs, retire `/help`) — filed here but gated on #6, and if it lands separately it becomes a `web-*` follow-up rather than widening this change to `shared-*`.

## Impact

- **New app:** `apps/support` (99 files) + `brand/baseout-bridge.css`. Root `pnpm-workspace.yaml` gains nothing (`apps/*` is already globbed); a `dev:support` root script is added alongside its siblings.
- **New dependency:** `@astrojs/starlight@^0.40.0` — MIT, Astro's own docs framework, `minimumReleaseAge`-gated like every other add.
- **New infra:** a D1 database + a KV namespace for this Worker, and a `baseout-support` Worker. Both declared in `wrangler.jsonc.example` and **commented until provisioned** — matching the fork's own stance and the repo's "renders wrangler config from an example" convention.
- **Security review points** (new app ⇒ CLAUDE.md §3.3 requires these called out):
  - **Anonymous vote dedupe is best-effort (cookie + IP hash) and is NOT a trust boundary.** It must not gate anything of value and must not store PII for anonymous visitors.
  - **Chat budget lives in KV keyed by a session cookie + IP hash** — same stance: an abuse speed-bump, not authentication.
  - **Ticket auth, when the bridge lands, is real session verification** against apps/web — never a spoofable header, never a client-asserted user id.
  - **No secrets in this app at launch.** The chat engine pairing introduces the first one (a model key) and must route it through Cloudflare Secrets, never `.dev.vars` committed.
  - The portal is **public and logged-out by default**; nothing it renders may come from the master DB.
- **Docs to update in the same change:** `shared/internal/ui-sync.md` §3 (a sync row for `252005be`) + §4 (a new row for the support surface); `openspec/changes/support-portal/README-IMPORT.md` (retire the "reference only" note, point at this change).

## Open Questions

1. **Client #6** — above. Blocks Phase 5 only.
2. **`support.baseout.com` or `support.baseout.dev`?** The fork's `astro.config.mjs` `site` says `.com`; `PRODUCT.md` says `.dev`. Pick one before the canonical URL reaches a sitemap or a doc link. Recommend `.com` (matches the `site` field the build actually consumes).
3. **Does the request board go live before there is anything on it?** An empty public roadmap is a worse signal than no roadmap. Recommend seeding it from the existing backlog, which is a content task, not a code one.

# support — Design

## Context

`apps/support` arrives as a **finished 99-file surface** from `ui-only@252005be`, not as a brief. The design work here is therefore integration, not invention: how a Starlight site lives in a pnpm monorepo whose UI governance was written for a daisyUI app, what storage it owns, and where it stops depending on the rest of the system.

The fork's own architectural notes (read them before changing anything — they are in the files' headers) settle several questions already:

- **Starlight slot overrides are the layout mechanism**, not a shortcut. `Header` is overridden because the nav belongs beside the brand and Starlight's grid sizes its first column to the docs sidebar. `Hero` is overridden because Starlight styles the `h1` in a component-scoped sheet, so `--sl-text-h1` never applied and it rendered 64px.
- **`brand/baseout-bridge.css` is deliberately unlayered**, which is why it wins over Starlight's layered styles without a specificity fight — and why it must never be pointed at `apps/web/src/styles/global.css`.
- **`/submit` and `/tickets` both redirect to `/contact`** because both were real published URLs and `/tickets` is where the chat's out-of-messages line pointed.

## Goals / Non-Goals

**Goals**
- Docs + roadmap launchable **without** the monorepo master DB, better-auth, or the engine.
- One visual product across apps/web and apps/support, achieved by a shared token bridge rather than shared components.
- A ticket door that works for someone with no account, because the person who most needs support is the one whose backup just failed.

**Non-Goals**
- The chat engine (corpus index + model calls + hard limits) — deferred pairing.
- Per-customer tickets — needs the cross-domain auth bridge; deferred pairing.
- Bringing `apps/support` under `audit:components` / Storybook. See D2.

## Decisions

### D1 — The support Worker owns its own storage; it never reads the master DB

Requests, votes and chat budgets live in **this app's own D1 + KV**. The portal is public and logged-out by default, so a master-DB dependency would put customer data one misconfiguration away from a public route, and would block launch on infra the portal does not need.

Consequence: the roadmap board's data is *not* the product backlog in `shared/`. Seeding is a content task (open question 3).

*Rejected:* reading the master DB through a Hyperdrive binding like `apps/admin` does. Admin is staff-gated; this is the public internet.

### D2 — apps/support is exempt from the two-tier UI gate, and the bridge sheet carries consistency instead

The `audit:components` gate scopes to apps/web and stays that way. Consistency is enforced by `brand/baseout-bridge.css` — one sheet, shared by the public apps, mapping Starlight's `--sl-*` custom properties onto Baseout tokens. Per-app rules stay **out** of the bridge (`support.css` sits on top of it); the bridge is the one sheet the other public apps also read.

This is an exception to a standing rule and is called out in the proposal for sign-off rather than assumed. The alternative is not "Starlight with daisyUI" — it is "not Starlight", i.e. re-designing a settled surface.

### D3 — Deferred pairings are honest states, not stubs that lie

- **Chat**: the UI shell, the anonymous budget affordance, and the "sign in to keep chatting" gate all ship. The responder is stubbed — and it must **say** it is not yet answering rather than emit a plausible non-answer. A support assistant that invents an answer is worse than an absent one.
- **Tickets**: until the auth bridge exists, `/contact` is the account-free door and is presented as the intended path, not as a degraded one. `/tickets` redirects there.

### D4 — Phase 5 (go-live) is a separate, gated slice — and it is the only part that touches apps/web

Retargeting the eleven support CTAs and retiring `/help` is the *only* work in this change that edits `apps/web`. It is fenced into its own phase because:

1. It is gated on client #6 (there must be something to point at).
2. Landing it would make this change touch two apps' source trees, which by §3.6 would re-prefix the whole thing `shared-*`. Keeping it fenced keeps the umbrella correctly single-app; if it ships independently it becomes a `web-support-bridge` follow-up ([one already exists](../web-support-bridge/) — reconcile with it rather than filing a third).

### D5 — Version pinning follows the tree, not the fork

The fork pins `astro@^6.1.2`, which **matches an app already in this repo**, so the astro/adapter pairing trap (`ui-sync.md` §5) does not fire. `@astrojs/starlight@^0.40.0` is the one genuinely new dependency and rides the standard `minimumReleaseAge` gate. Do not "upgrade while we're here" — §3.2.

## Risks

- **Starlight upgrades break slot overrides.** Eight overrides against Starlight internals (a component-scoped sheet, a grid whose first column is sized to the sidebar) is real coupling. Mitigation: the overrides carry the fork's explanatory headers; pin Starlight and treat a minor bump as a change with its own visual verification, not a chore.
- **The bridge sheet is unlayered on purpose.** That makes it powerful and makes it easy to break. It has one warning in its header; keep it, and never widen its scope to apps/web's global sheet.
- **A public roadmap invites a support load of its own.** Voting and duplicate-search reduce it; nothing eliminates it. This is a product cost of Phase 4, not a bug.
- **99 files arrive at once.** They are verbatim from a settled fork surface, so review is import-review (does it build, does it render, does it leak) rather than line-review. Say so in the PR body rather than implying a line-by-line read happened.

## Migration

Additive. A new app directory, one new brand sheet, one new dependency, one new Worker with its own D1 + KV. Nothing in `apps/web`, `apps/server`, `apps/workflows`, or the master DB changes until Phase 5 — which is gated.

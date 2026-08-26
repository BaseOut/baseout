# Tasks

## 1. Scaffold (this change)

- [x] 1.1 `apps/support` (`@baseout/support`): Astro + Starlight, seed docs (index, getting-started, FAQ stub), sidebar config, wrangler.jsonc (D1/KV bindings declared, commented), README.
- [x] 1.2 `/roadmap` custom page: three columns over fixture data, vote button with local (non-persisted) count bump + "votes go live soon" note.
- [x] 1.3 `/chat` custom page: conversation shell + composer, stub responder, message-budget affordance with the sign-in swap.
- [x] 1.4 `/tickets` custom page: signed-out state linking to the app login.

## 2. Make it real (follow-ups within this change's scope)

- [ ] 2.1 Provision D1 + KV; roadmap `features`/`votes` migrations + seeded features; vote endpoint (unique voter_hash) + counts SSR'd.
- [ ] 2.2 Chat budget enforced in KV server-side behind the stub responder; budget config via env.
- [ ] 2.3 Real docs IA: per-product-area guides + troubleshooting, written against the shipped feature set (claim hygiene — document only what exists).
- [ ] 2.4 Deploy to support.baseout.com; search verified; three breakpoints walked.

## 3. Deferred pairings (file separately, do not build here)

- [ ] 3.1 Monorepo change: support↔app **auth bridge** (server-side session verification, admin-console pattern) + ticket storage/API + ticket email notifications. `/tickets` stays signed-out-only until it lands.
- [ ] 3.2 Chat **engine** change: docs-corpus grounding + model call + server-enforced limits + sign-in tier; source links in answers.
- [ ] 3.3 Signed-in voting attribution on the roadmap via the same bridge.

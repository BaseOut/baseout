# web-design-mode

Turns `apps/web` into a fully click-around demo of itself behind a single env flag (`PUBLIC_DESIGN_MODE=true`). Designer lands signed-in, browses every customer-facing surface — marketing, onboarding, Connect flows, dashboard, backups, restores, settings, and the `/ops` staff console — without a real PostgreSQL, real `better-auth` magic-link round-trip, real Airtable/Drive/Dropbox/Box/OneDrive OAuth, real `apps/server` engine, real Stripe, or real Mailgun email. Same Astro source, same components, same routes, same daisyUI + `@opensided/theme` styling — design and engineering stay in lockstep as new screens ship.

Architecture: PGlite (in-memory Postgres in WASM) swapped in at the `createDb()` chokepoint with the real Drizzle schema and a seeded demo Org; auth replaced by a stub-session middleware branch; external HTTP calls (engine service binding, Stripe, OAuth, email) replaced by in-process fakes; a floating designer control panel (DESIGN_MODE-only) for switching active user / org tier / Space and jumping to named demo scenarios.

Deploy target: a separate `baseout-design` Cloudflare Worker with **no** real secrets, **no** Hyperdrive binding, **no** `BACKUP_ENGINE` service binding — defense-in-depth so a misconfigured fake can't reach production state. Production Workers do not bundle PGlite (verified by a build-time tree-shake check).

Cross-app: this change is `apps/web`-only. `apps/server`, `apps/workflows`, and the master Postgres are untouched. The change reaches the designer-facing UI by stubbing every place `apps/web` crosses a process boundary — see [design.md](./design.md) §Overview.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.

This directory is the **root knowledge graph** for the Baseout monorepo, managed by [lat.md](https://www.npmjs.com/package/lat.md). It captures the persistent state of the system — naming, architecture, security model, tech stack, cross-app communication, pricing — distinct from [openspec/](../openspec/) which captures **proposed changes**. Per-app graphs live in [apps/&lt;name&gt;/lat.md/](../apps/). See [[openspec-vs-lat]] for the rule of thumb.

## Sections

The files in this graph. Each is one logical concern; cross-link via `[[file]]` or `[[file#H1#H2]]`.

- [[domain-model]] — Canonical entity model and naming dictionary (Organization, Space, Platform, Connection, Base, Capability, etc.)
- [[monorepo-layout]] — pnpm workspace layout, frontend/backend split, toolchain
- [[tech-stack]] — Languages, runtimes, frameworks, deployment targets
- [[security-model]] — Secrets, encryption-at-rest, magic-link auth, INTERNAL_TOKEN gate, parameterized SQL
- [[cross-app-comm]] — How apps/* talk to each other (HMAC service tokens, INTERNAL_TOKEN, WebSocket DOs)
- [[pricing-tiers]] — Tier ladder + capability gating from Stripe metadata
- [[db-schema-overview]] — Drizzle conventions, encrypted columns, mirrored vs canonical tables
- [[engineering-principles]] — TDD discipline, no drive-by refactor, no console logs, OpenSpec change flow
- [[openspec-vs-lat]] — When to use OpenSpec (deltas) vs lat.md (current state); cross-graph linking convention

# system-platform-abstraction

## Why

Airtable was acquired by Bending Spoons. That raises a founder-level question about platform risk and optionality: **can Baseout's infrastructure add a second data source cheaply — weeks, not months?** — and a concrete candidate to explore, **Zite** (an AI-native no-code database, ~200k customers, weak native backup/export tooling; the founder knows the Zite founders and can request API access). This change answers that question with a **readiness assessment and an adapter-interface design**, not a build.

The honest starting point: multi-platform is **explicitly PRD V2** and out of scope for V1 (`shared/Baseout_PRD.md:465` — "even though V1 is Airtable-only, the UI framework must be built to support multiple platforms … so switching context is built into the architecture from day one"; the "Won't Have (yet)" rows at `shared/Baseout_PRD.md:750-751`; CLAUDE.md §1 — "V2-only … out of scope unless explicitly requested"). This change is therefore framed as an **explicitly-requested assessment + design artifact**. It ships **no runtime code** and makes **no commitment** to ship V1 multi-platform. It exists so the founder can make the second-platform decision on real evidence, and so that when V2 is greenlit the seam is already specified.

The good news the assessment surfaces: the **control plane is already platform-abstracted** (a seeded `platforms` reference table, a `space_platforms` join table, `connections.platformId` + per-platform `platform_config`, `subscription_items.platformId`, and a `resolveCapabilities(orgId, platformSlug)` resolver already parameterized by platform). The bad news: the **execution layer is Airtable-shaped end-to-end** — there is no source-provider adapter interface today, unlike the destination side, which already has a clean per-provider writer set. This change catalogs every execution-layer chokepoint (file:line) and proposes the missing seam by mirroring the destination-writers pattern.

## What Changes

This is a spec/design change: it adds a new capability spec and the design/assessment artifacts. No `apps/*` source is modified.

- **Readiness assessment (design.md).** A chokepoint catalog grouped by layer — OAuth/connection, read client, write client, field (de)normalization, capture pipeline, payload schema, and hardcoded query filters — each with a `file:line` citation, plus a per-chokepoint effort estimate for adding Zite as the second source platform and a concrete weeks-vs-months verdict.
- **Source-provider adapter interface (design + spec).** A proposed `SourcePlatformClient` contract (`listBases` / `getSchema` / `listRecords` for capture, a create/write surface for restore, plus `normalizeFieldValue` / `denormalizeFieldValue` hooks and an OAuth-flow registration) — the symmetric counterpart to the destination `resolveStorageWriter` factory. Airtable becomes the first adapter; Zite the second. The capture pipeline (`backup-base.ts`), schema-diff, and collaborators-sync would depend on the interface rather than importing `createAirtableClient` directly.
- **Catalog gating (spec).** A source platform is selectable only when an adapter + OAuth flow are registered; `SOURCE_PLATFORMS` availability flips `coming_soon` → `available` per registered adapter — mirroring how destination providers are env-gated in `provider-catalog.ts`.
- **Platform-resolution rule (spec).** The ~19 hardcoded `eq(platforms.slug, 'airtable')` query filters (and the JS-side `platformSlug === 'airtable'` checks) resolve the platform from Space/Connection context instead of a string literal, so a second platform is not silently excluded.
- **Payload-schema strategy (open question, design.md).** The hardest problem: the Airtable-shaped `bo_at_*` / `at_*` per-Space + master table set. Does a second platform reuse it, get its own `bo_zt_*` schema, or map to a normalized canonical shape? Flagged explicitly for a founder/architecture decision — it is the single biggest driver of the effort estimate.

Out of scope: any implementation code; any control-plane schema change (the existing platform tables suffice); any V1 behavior change; committing to ship multi-platform in V1; the Zite API integration itself (gated on the founder obtaining Zite API docs — an external dependency).

## Capabilities

### New Capabilities

- `platform-abstraction`: the source-provider adapter interface contract — a uniform `SourcePlatformClient` every capture/restore consumer depends on, adapter/OAuth registration with catalog gating, platform resolution from context (retiring hardcoded slug filters), per-adapter field-type mapping, and an explicit per-adapter payload-schema strategy. Defines the seam that lets Airtable be adapter #1 and a second platform (Zite) be adapter #2.

### Modified Capabilities

_None in `openspec/specs/`. This change adds a design/assessment artifact and one new capability spec; it does not archive or supersede any existing capability. It documents (does not alter) the already-abstracted control-plane behavior owned by `system-per-space-db` and the entitlements specs, and the already-shipped destination-writers pattern it mirrors._

## Impact

- **Assessment/design only.** No `apps/*` file is touched by this change. When the design is later implemented under V2, it becomes a `system-*` change (the refactor lands across `apps/web`, `apps/server`, `apps/workflows`, and `packages/db-schema` as a unit — reverting it would touch three-plus app trees, so it is `system-` per CLAUDE.md §3.6).
- **Code (future, scoped here for estimation):** a new `SourcePlatformClient` interface + registry (mirror of `apps/workflows/trigger/tasks/_lib/storage-writers/`), an Airtable adapter wrapping today's `createAirtableClient`, refactors of `backup-base.ts` / `schema-diff.ts` / `collaborators-sync.ts` to depend on the interface, a per-platform OAuth-flow registration extracted from `apps/web/src/lib/airtable/*` + `apps/web/src/pages/api/connections/airtable/*`, and a sweep of the ~19 hardcoded `platforms.slug = 'airtable'` filters.
- **DB (future):** no control-plane migration — `platforms`, `space_platforms`, `connections.platformId`, `subscription_items.platformId` already model multi-platform. The only DB question is the per-Space **payload schema** (reuse `bo_at_*` vs new `bo_zt_*` vs normalized), deferred to the open question.
- **Security:** no new secrets, auth paths, or SQL surfaces in this change (it is documentation). The future adapter work would add one new OAuth provider integration per platform — flagged for security review at that point (new external integration + new OAuth scopes per CLAUDE.md §3.3 / §3.7; the adapter registration must not weaken the per-provider isolation the OAuth runbook enforces).
- **External dependency:** the Zite estimate is gated on obtaining **Zite API documentation** (auth model, schema/metadata API, record pagination, rate limits, field-type system) — the founder's action to reach out to the Zite founders. Read-client and field-normalizer estimates cannot be firmed up without it.
- **Coordination:** references but does not modify `system-per-space-db` (the `bo_at_*` payload model), the entitlements specs (platform-parameterized `resolveCapabilities`), and `shared-byos-drive` / `workflows-r2-writer` (the destination-writers pattern this design mirrors).

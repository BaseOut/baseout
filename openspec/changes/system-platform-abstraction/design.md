# system-platform-abstraction — design

> Assessment + design artifact only (PRD V2 boundary). This document is the deliverable of tasks.md §1–§3. It ships **no runtime code** and modifies **no `apps/*` file**. Sections §4–§8 of tasks.md are the scoped-but-unauthorized future V2 implementation plan.
>
> **Citation discipline:** every claim below is grounded in a live `path:line`, verified against the tree on 2026-08-05. Where the earlier draft had drifted line numbers they are corrected inline and flagged. Nothing is asserted without a citation.

## Context

Today's meeting driver: **Airtable was acquired by Bending Spoons.** The founder wants two things: (a) confidence that Baseout's infrastructure can add a **second data-source platform cheaply** — his framing was literally *"a month, not six months?"* — and (b) a specific candidate assessed: **Zite**, an AI-native no-code database with ~200k customers and weak native backup/export tooling. He knows the Zite founders and can request API access. This document is the answer: a readiness assessment plus the adapter-interface design that would make a second platform tractable.

**Scope boundary, stated up front.** Multi-platform is **explicitly PRD V2**, not V1:

- `shared/Baseout_PRD.md:465` — *"Platform-agnostic foundation — even though V1 is Airtable-only, the UI framework must be built to support multiple platforms (Notion, HubSpot, etc.) so switching context is built into the architecture from day one."* (The earlier draft cited `:47`; the quote actually lives at `:465`. `:47` is the product tagline line.)
- `shared/Baseout_PRD.md:750` — "Won't Have (yet): Multi-platform Spaces (V2+)" and `:751` — "Won't Have (yet): Multi-platform integrations (Notion, Coda, HubSpot, Salesforce)". (Earlier draft cited `:465` for the "Won't Have" rows; that line is the platform-agnostic bullet, not a Won't-Have row.)
- CLAUDE.md §1 — *"V2-only capabilities (MCP server, RAG, Governance, third-party connectors, multi-platform Spaces) are out of scope unless explicitly requested."*

This change is that **explicit request**, scoped as an assessment + design. The PRD already asks the *UI framework* to be platform-ready from day one; this design extends that same "ready, not shipped" posture to the *execution layer*.

**The two-layer split the assessment turns on** — the control plane is already platform-abstracted (leverage it, §1.2); the execution plane is Airtable-shaped end to end (the chokepoints, §1.1). **The pattern to mirror:** the *destination* side already solved this exact shape of problem with a per-provider `StorageWriter` set behind a `resolveStorageWriter(storageType, creds)` factory (`apps/workflows/trigger/tasks/_lib/storage-writers/index.ts:51-75`), env-gated by `getDestinationProviders(env)` (`apps/web/src/lib/provider-catalog.ts:165-174`). The source side has no equivalent seam. This design proposes the symmetric `SourcePlatformClient`.

## Goals / Non-Goals

**Goals**

- A defensible, cited **readiness assessment**: where the Airtable coupling lives, grouped by layer, each with `file:line` (§1.1); credit for the already-abstracted control plane (§1.2); an exact enumeration of the hardcoded platform literals (§1.3); and an order-of-magnitude effort estimate with a weeks-vs-months verdict (§1.4).
- A proposed **source-provider adapter interface** (`SourcePlatformClient`) mirroring the destination-writers pattern — the missing seam (§2).
- **Zite spike prep** (§3): the API-docs the founder must obtain, the acceptance test that validates the interface, and a structural read on whether Zite even fits the model.

**Non-Goals**

- No implementation. No `apps/*` file is modified by this change.
- No commitment to ship multi-platform in V1 — this preserves the PRD V2 boundary.
- No control-plane schema change — the existing platform tables suffice (§1.2 / D1).
- No Zite API integration — gated on obtaining Zite's API docs (external; §3.1).
- No multi-platform *Spaces* design (one Space still equals one platform; `spaces.spaceType` defaults `'single_platform'` at `apps/web/src/db/schema/core.ts:118`, with `'multi_platform' (V2)` reserved at `:119`). This change makes a *second* platform possible, not two platforms *in one Space*.

---

## §1 Readiness assessment

### §1.1 Chokepoint catalog

Grouped by layer. Each is a place where "Airtable" is assumed rather than parameterized. Effort tags (`S` ≈ ≤2 days, `M` ≈ ~1 week, `L` ≈ ~2 weeks) are for *adding one more platform once the seam exists*; the seam itself is estimated separately in §1.4.

#### 1. OAuth / connection flow — `M`
- **Routes (per-provider, single provider today):** `apps/web/src/pages/api/connections/airtable/start.ts`, `.../callback.ts`, `.../disconnect.ts`, `.../_engine-status.ts` — the entire Connect flow is literally namespaced under `.../airtable/`.
- **Module set:** `apps/web/src/lib/airtable/` holds `config.ts`, `oauth.ts`, `persist.ts`, `disconnect.ts`, `sso.ts`, `sso-linked.ts`, `cookie.ts`, `return-to.ts`, `success-redirect.ts`, `client.ts` (verified by directory listing) — no provider-neutral registration point.
- **Coupling:** redirect-URI construction, token exchange, the `platform_config` shape (`{ at_user_id, at_workspace_id, is_enterprise_scope }`, documented at `apps/web/src/db/schema/core.ts:277`), and persistence all assume Airtable. A second platform needs its own module set + routes — which CLAUDE.md §3.7 (`oauth-setup.md`) requires anyway: each provider is an isolation boundary.

#### 2. Read client (capture) — `M` (gated on Zite API docs)
- `apps/workflows/trigger/tasks/_lib/airtable-client.ts:146-154` — `interface AirtableClient { listBases(); getBaseSchema(baseId); listRecords(baseId, tableIdOrName, opts) }`; `createAirtableClient(opts)` at `:158`; hardcoded `AIRTABLE_BASE_URL = "https://api.airtable.com"` at `:19`. The `opts.fetchImpl ?? fetch` (`:161`, declared at `:96`) is a **test seam, not a provider seam** — it swaps the transport, not the platform. Backoff is tuned to Airtable's "5 req/sec/base" limit (`:123-124`).
- `apps/server/src/lib/airtable/client.ts:116-124` — the same `AirtableClient` interface mirrored engine-side (`listBases`/`getBaseSchema`/`listRecords` at `:117-119`).
- **Coupling:** the interface *shape* (bases → tables/fields/views → records, offset pagination, rate-limit backoff) is already close to a generic contract — this is the least-bad chokepoint and the natural basis for `SourcePlatformClient` (§2.1).

#### 3. Write client (restore) — `S`–`M`
- `apps/workflows/trigger/tasks/_lib/airtable-create.ts` — `createRecords(...)` at `:133`, `POST /v0/:baseId/:tableId` at `:146`, batches of 10 (`BATCH_SIZE = 10` at `:28`), `typecast: true` body at `:99`.
- **Coupling:** restore write semantics (create records/fields/tables) are Airtable-API-specific; a second platform needs its own write module. Mirrors the backup/restore symmetry in `apps/server/CLAUDE.md`.

#### 4. Field (de)normalization — `M` (gated on Zite type system)
- `apps/workflows/trigger/tasks/_lib/field-normalizer.ts:12` — `normalizeFieldValue(value: unknown, fieldType: string)` maps Airtable field types → canonical stored value (`multipleRecordLinks` → comma-joined ids at `:16-18`; `multipleAttachments` → `"[N attachments]"` placeholder at `:19-21`).
- `apps/workflows/trigger/tasks/_lib/field-denormalizer.ts:41` — `denormalizeFieldValue(cell: string, fieldType: string)`, the inverse for restore (handles `multipleRecordLinks`, `multipleSelects`, `number`, `checkbox` at `:48-81`).
- **Coupling:** the type taxonomy (single-select, linked-record, attachment, number, checkbox, …) is Airtable's. A second platform maps its own type system in/out. Per-adapter by nature — a natural hook on `SourcePlatformClient` (§2.1 / D5).

#### 5. Capture pipeline bound to the concrete client — `S` (once the interface exists)
- `apps/workflows/trigger/tasks/backup-base.ts:26` — `import { createAirtableClient }` directly; instantiated at `:775` (`createAirtableClient({ accessToken, fetchImpl: fetchFn })`). There **is** an injected `deps.airtableClient?` seam (`:208`, typed `AirtableClientShape` at `:149`, used at `:773-775`) — but that is an Airtable-*shaped* test seam, not a provider abstraction.
- `apps/server/src/lib/per-space/schema-diff.ts:18` — `export type EntityType = "base" | "table" | "field" | "view"`, with the comment "Captured (normalized from Airtable getBaseSchema)" at `:20`. The diff model is Airtable's entity hierarchy. (Earlier draft cited `:20` for `EntityType`; the type is at `:18`, the comment at `:20`.)
- `apps/server/src/lib/per-space/collaborators-sync.ts` — parses Airtable's `GET /v0/meta/bases/{id}?include=collaborators` payload verbatim (comment at `:4`; per-interface + deprecated top-level `collaborators` parsing at `:185-204`).
- **Coupling:** these consume Airtable's client/response shapes directly. Once `SourcePlatformClient` exists, wiring them is mechanical — *but* schema-diff and collaborators-sync also assume Airtable's **entity model**, which bleeds into the payload-schema question (§2.5).

#### 6. Payload schema — `L`+ (the hard problem — see §2.5 / D6)
- `packages/db-schema/src/space/*` and `apps/*/src/db/schema/*` — the entire `bo_at_*` (per-Space) + `at_*` (master, e.g. `at_bases` documented at `apps/web/src/db/schema/core.ts:152-159`) table set. `bo_` = Baseout-owned, `at_` = Airtable namespace (per `system-per-space-db` Decision 6; `notion` would be `bo_no_`, per the platform `code` prefix documented at `apps/web/src/db/schema/core.ts:37-38,44`). Dual-dialect (SQLite for D1 + Postgres), authored twice.
- **Coupling:** the stored shape *is* Airtable's data model (bases/tables/fields/views/records + EAV cells + schema-version history). Single largest driver of the estimate; deferred to §2.5 / Open Questions.

#### 7. Hardcoded platform identity in queries — `S` (mechanical sweep) — see §1.3
- **24 non-test hardcoded platform-identity literals** total: **18** `eq(platforms.slug, 'airtable')` SQL filters + **6** JS-side `platformSlug === 'airtable'` checks. Enumerated exhaustively in §1.3.
- **Coupling:** each literal silently excludes any non-Airtable platform. The fix is to resolve platform from Space/Connection context (or thread a `platformSlug` param) — low-risk but high-count, so it is a real line item (D4).

### §1.2 Control plane — already abstracted (credit what exists)

Adding a second platform requires **no new control-plane tables**. The master DB already models multiple platforms:

| Surface | Location | What it proves |
|---|---|---|
| `platforms` reference table | `apps/web/src/db/schema/core.ts:41-51` | `slug` (`'airtable' \| 'notion' \| 'hubspot'`, `:43`), `code` (`'at' \| 'nt' \| 'hs'`, `:44`, documented as the per-platform table prefix at `:37-38`) |
| `space_platforms` join | `apps/web/src/db/schema/core.ts:137-149` | commented *"V1: always one row per Space. V2 multi-platform Spaces will have multiple rows"* (`:134`) |
| `spaces.spaceType` | `apps/web/src/db/schema/core.ts:118-119` | defaults `'single_platform'`; `'multi_platform' (V2)` reserved |
| `connections.platformId` FK | `apps/web/src/db/schema/core.ts:259-261` | plus per-platform `platform_config` jsonb (`:276`) documented for `airtable`/`notion`/`hubspot` (`:277-279`); `connections_org_platform_idx` at `:300` |
| `subscription_items.platformId` | web `apps/web/src/db/schema/core.ts:431` (table `:426`, unique `_sub_platform_unique` `:453`); engine mirror `apps/server/src/db/schema/subscription-items.ts:25` | one subscription item row per active platform |
| `resolveCapabilities(…, platformSlug)` | engine `apps/server/src/lib/capabilities/resolve.ts:49` (param), `:62` (`eq(platforms.slug, platformSlug)` join); web `apps/web/src/lib/capabilities/resolve.ts:79` (param), `:90` (join) | capability resolution is **already platform-parameterized** — these two `eq(platforms.slug, platformSlug)` sites are the *correct* pattern the §1.3 literals should converge on |
| `SOURCE_PLATFORMS` catalog | `apps/web/src/lib/provider-catalog.ts:153-158` | `airtable: 'available'` (`:154`); `notion`/`hubspot`/`salesforce: 'coming_soon'` (`:155-157`) — the UI-facing on/off switch |

**Net:** onboarding a platform's control plane is *days* — seed a `platforms` row (`slug`, `code`), add a `space_platforms` link, point `connections`/`subscription_items` at it, seed the entitlement-catalog rows (a data change per `Baseout_Features.md` §3, not a schema change), and flip the catalog. The entire cost is in the execution plane (§1.1).

### §1.3 Hardcoded platform literals (exact enumeration)

Verified count on 2026-08-05: **18 SQL filters + 6 JS-side checks = 24 total** hardcoded platform-identity literals (tasks.md estimated "~19"; that undercount omitted the JS side and counted the 2 parameterized `platformSlug` sites). Excluded as *correct* (not literals): the 2 parameterized `eq(platforms.slug, platformSlug)` joins in the two `resolveCapabilities` files (§1.2). Also excluded: `apps/design/src/components/schema/EntityPanel.astro` `field === 'airtable'` matches — those are description-*tab* names ("airtable" vs "extended"), not platform identity, and live in the design harness.

**18 × `eq(platforms.slug, 'airtable')` (SQL filters):**

| # | file:line | app |
|---|---|---|
| 1 | `apps/admin/src/pages/api/actions/force-backup.ts:118` | admin |
| 2 | `apps/server/src/durable-objects/SpaceDO.ts:630` | server |
| 3 | `apps/server/src/lib/cron/oauth-refresh-deps.ts:79` | server |
| 4 | `apps/server/src/lib/cron/oauth-refresh-deps.ts:128` | server |
| 5 | `apps/server/src/lib/cron/oauth-refresh-deps.ts:215` | server |
| 6 | `apps/server/src/lib/rediscovery/run-deps.ts:102` | server |
| 7 | `apps/server/src/pages/api/internal/connections/token-health.ts:49` | server |
| 8 | `apps/server/src/pages/api/internal/connections/token-health.ts:61` | server |
| 9 | `apps/server/src/pages/api/internal/spaces/register-webhooks.ts:133` | server |
| 10 | `apps/web/src/lib/airtable/disconnect.ts:27` | web |
| 11 | `apps/web/src/lib/airtable/persist.ts:44` | web |
| 12 | `apps/web/src/lib/airtable/sso-linked.ts:72` | web |
| 13 | `apps/web/src/lib/integrations.ts:139` | web |
| 14 | `apps/web/src/lib/integrations.ts:169` | web |
| 15 | `apps/web/src/pages/api/spaces/[spaceId]/backup-runs.ts:211` | web |
| 16 | `apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts:217` | web |
| 17 | `apps/web/src/pages/api/spaces/[spaceId]/restore.ts:260` | web |
| 18 | `apps/web/src/pages/api/spaces/[spaceId]/workspaces.ts:351` | web |

**6 × JS-side `platformSlug === 'airtable'` (post-query filters over resolved connections):**

| # | file:line | app |
|---|---|---|
| 1 | `apps/web/src/lib/registry-mappers.ts:23` | web |
| 2 | `apps/web/src/pages/api/dashboard.ts:25` | web |
| 3 | `apps/web/src/pages/backups.astro:38` | web |
| 4 | `apps/web/src/pages/integrations/configure.astro:22` | web |
| 5 | `apps/web/src/pages/integrations/configure/bases.astro:18` | web |
| 6 | `apps/web/src/views/DashboardView.astro:30` | web |

All tasks.md §4.1 / §4.2 / §4.3 expected locations were verified present at (or within one line of) the cited positions; none had drifted away, only the aggregate count was off.

### §1.4 Effort estimate — adding Zite as source platform #2

Rough order of magnitude. Two costs, kept separate because they answer different questions.

**One-time seam cost (pay once, benefits every future platform):**

| Work | Estimate |
|---|---|
| `SourcePlatformClient` interface + `resolveSourceClient` factory + Airtable adapter (wrap existing client) | ~1 week |
| Refactor `backup-base.ts` / `schema-diff.ts` / `collaborators-sync.ts` to depend on the interface | ~2–3 days |
| Sweep the 24 hardcoded literals (18 SQL + 6 JS, §1.3) → context resolution | ~2–3 days |
| Per-platform OAuth-flow registration (extract Airtable's module set behind a registration point) | ~3–5 days |
| **Seam subtotal** | **~2–3 weeks** |

**Per-Zite adapter cost (on top of the seam):**

| Work | Estimate | Notes |
|---|---|---|
| Zite OAuth/Connect module + routes | ~3–5 days | depends on Zite auth model (OAuth vs API key) — **needs docs** |
| Zite read client (`SourcePlatformClient` impl) | ~1 week | depends on Zite schema/records API + pagination/rate limits — **needs docs** |
| Zite field-type normalize/denormalize | ~3–5 days | depends on Zite's type taxonomy richness — **needs docs** |
| Zite write client (restore) | ~3–5 days | |
| Payload schema | **~1 day (option a) → ~2 weeks (option b)** | the §2.5 decision dominates |
| UI catalog flip + wizard/dashboard platform-awareness | ~2–3 days | |
| **Zite subtotal** | **~2.5–5 weeks** | wide end = new `bo_zt_*` schema |

**Verdict for the founder — "a month, not six months?":** Roughly right in spirit, wrong on the literal month from a cold start. Total realistic engineering is **~6–10 focused engineering-weeks** for the seam plus the first Zite adapter — call it **~1.5–2.5 months for one engineer, or ~1 month with two engineers parallelizing** the seam and the adapter. That is **weeks-scale, decisively not six months** — the control plane being pre-abstracted (§1.2) is why. But it is **not one month from where we stand today**, and it hinges on two things: (1) the **payload-schema decision** (§2.5 — reusing/normalizing keeps it at the low end; a fresh `bo_zt_*` schema pushes it toward the high end), and (2) **Zite's API surface** — three of the Zite line items are gated on docs we don't have (§3.1). If Zite's API is well-documented and Airtable-shaped and we reuse the payload schema, one month with two engineers is achievable. If Zite's model is exotic or we build a normalized schema, plan for two-plus months.

---

## §2 Adapter-interface design (specification)

This is a specification, not code. The shapes below are TypeScript-shaped pseudocode intended to be faithful to the destination-side pattern they mirror, so the future implementation (tasks.md §5) is an "extract, don't invent" exercise.

### §2.1 The `SourcePlatformClient` contract

Mirror the destination `StorageWriter` interface (`apps/workflows/trigger/tasks/_lib/storage-writer.ts:12-59` — a single interface, one method per capability, JSDoc stating the throw contract) rather than inventing a new convention. `SourcePlatformClient` is the **generalization of today's `AirtableClient`** (`airtable-client.ts:146-154`), widened to carry the restore write surface and the two field-mapping hooks, and renamed to platform-neutral vocabulary (Airtable "base" → generic "container").

```ts
// The capture + restore contract every source platform implements.
// Neutral vocabulary: Airtable "base" → "container"; "table" stays; a record's
// cells are keyed by field. Shapes below (SourceContainerSummary / SourceSchema /
// SourceRecordsPage) are the platform-neutral counterparts of AirtableBaseSummary
// / AirtableSchema / AirtableRecordsPage (airtable-client.ts:21-70).
interface SourcePlatformClient {
  // ---- capture (generalizes AirtableClient.listBases/getBaseSchema/listRecords) ----

  /** Enumerate the top-level containers the connection can see.
   *  Airtable: GET /v0/meta/bases. Throws SourcePlatformError on exhausted retries. */
  listContainers(): Promise<SourceContainerSummary[]>;

  /** Fetch one container's schema (tables → fields → views), platform-neutral.
   *  Airtable: GET /v0/meta/bases/:id/tables. This is the shape schema-diff.ts
   *  must consume (it currently assumes Airtable's getBaseSchema — chokepoint #5). */
  getSchema(containerId: string): Promise<SourceSchema>;

  /** List one table's records, one page at a time. `opts.cursor` is the neutral
   *  rename of Airtable's `offset`. Airtable: GET /v0/:base/:table?pageSize&offset. */
  listRecords(
    containerId: string,
    tableRef: string,
    opts?: ListRecordsOptions,      // { cursor?, pageSize?, fields?, ... }
  ): Promise<SourceRecordsPage>;    // { records, cursor? }

  // ---- restore (generalizes airtable-create.ts createRecords) ----

  /** Batch-create records for restore. Optional: a platform whose API is
   *  read-only declares this absent and is flagged backup-only (mirrors how a
   *  BYOS writer can omit an operation). Airtable: POST /v0/:base/:table. */
  createRecords?(
    containerId: string,
    tableRef: string,
    records: SourceCreateInput[],
  ): Promise<SourceCreateResult>;

  // ---- field-type mapping hooks (per-adapter; D5) ----

  /** Backup direction: native cell value → canonical stored value.
   *  Extracted from field-normalizer.ts:12 (currently a free function). */
  normalizeFieldValue(value: unknown, fieldType: string): unknown;

  /** Restore direction: canonical stored value → native cell value.
   *  Extracted from field-denormalizer.ts:41. */
  denormalizeFieldValue(cell: string, fieldType: string): unknown;
}
```

Notes on fidelity:
- **Read methods** are a 1:1 rename of `AirtableClient` (`airtable-client.ts:146-154`) — `listBases`→`listContainers`, `getBaseSchema`→`getSchema`, `offset`→`cursor`. Airtable's rate-limit backoff (`airtable-client.ts:119-137`) stays *inside* the Airtable adapter, exactly as R2's SigV4 signing stays inside `r2.ts`.
- **`createRecords?` is optional** to mirror the destination side, where a writer can support a subset of operations and the factory degrades gracefully (`storage-writers/index.ts:70-74`). A backup-only platform is expressible.
- **The two field hooks move onto the adapter** (D5). Today they are free functions in `_lib/`; on the interface they become per-platform methods, and the canonical stored `value` (JSON-encoded per `system-per-space-db` Decision 9) stays platform-neutral.

### §2.2 `resolveSourceClient(platformSlug, creds)` dispatch factory

Mirror `resolveStorageWriter(storageType, creds)` (`storage-writers/index.ts:51-75`) exactly: a single dispatch function keyed on a string, over a discriminated-union creds type, returning the concrete client; one module per platform under a `sources/` directory (the symmetric counterpart of `storage-writers/`).

```ts
// apps/workflows/trigger/tasks/_lib/sources/index.ts  (mirror of storage-writers/index.ts)

import type { SourcePlatformClient } from "../source-platform-client";
import { createAirtableSource, type AirtableSourceCreds } from "./airtable";
// import { createZiteSource, type ZiteSourceCreds } from "./zite";  // adapter #2

// Discriminated union, mirroring StorageWriterCreds (index.ts:38-43).
// Each adapter adds its own variant; the factory dispatches on `kind`.
export type SourceCreds =
  | ({ kind: "airtable" } & AirtableSourceCreds);
//| ({ kind: "zite" } & ZiteSourceCreds);

export function resolveSourceClient(
  platformSlug: string,
  creds: SourceCreds,
): SourcePlatformClient {
  if (platformSlug === "airtable" && creds.kind === "airtable") {
    return createAirtableSource({ creds });   // wraps createAirtableClient(...)
  }
  // if (platformSlug === "zite" && creds.kind === "zite") return createZiteSource({ creds });
  throw new Error(`No source adapter registered for platform '${platformSlug}'`);
}
```

- **Registration style** is identical to destinations: one `sources/<slug>.ts` module per platform, imported and dispatched in `sources/index.ts`. Adding a platform = add a module + one `if` arm + one union variant.
- **Difference from destinations, deliberate:** destinations *fall back* to `LocalFsWriter` for unknown types (`index.ts:70-74`, graceful degradation for dev). Sources instead **throw** on an unregistered platform — there is no safe "fall back to some other data source," and D3's catalog gating guarantees an unregistered platform is never user-selectable in the first place, so the throw is defense-in-depth, not a live path.
- **Airtable adapter is a wrapper**, not a rewrite: `createAirtableSource` composes `createAirtableClient` (`airtable-client.ts:158`) + the two field hooks + `createRecords` (`airtable-create.ts:133`). Behavior-preserving; Airtable's existing Vitest suite stays green (tasks.md §5.2).

### §2.3 Catalog gating — availability governed by adapter + OAuth registration

Mirror `getDestinationProviders(env)` (`apps/web/src/lib/provider-catalog.ts:165-174`), which flips a provider's static `coming_soon` default to `available` **only when** its OAuth client-id env var is present (the `gate` map at `:166-170`). The source side gets the symmetric function over `SOURCE_PLATFORMS` (`:153-158`):

```ts
// apps/web/src/lib/provider-catalog.ts  (new, symmetric to getDestinationProviders)

/** A source platform is `available` only when BOTH:
 *   (1) an adapter is registered  — resolveSourceClient(slug) does not throw, and
 *   (2) its OAuth Connect flow is registered — the platform's start/callback/
 *       disconnect routes exist and its client-id env is configured.
 *  Otherwise it stays `coming_soon`, exactly as an env-gated BYOS provider does. */
export function getSourcePlatforms(gate: SourcePlatformGate = {}): SourcePlatform[] {
  return SOURCE_PLATFORMS.map((p) =>
    p.availability === "coming_soon" && gate[p.slug]?.adapter && gate[p.slug]?.oauth
      ? { ...p, availability: "available" }
      : { ...p },
  );
}
```

This makes "turn Zite on" a **single testable predicate** (adapter registered ∧ OAuth registered) rather than a scattered set of edits, and prevents a half-wired platform from being user-selectable — the exact property `getDestinationProviders` gives BYOS providers today. `SOURCE_PLATFORMS` stays the single source of truth read by both the account-level registry and the per-Space picker (per the module's own header comment, `provider-catalog.ts:1-15`), so they can never disagree.

### §2.4 Per-platform OAuth-flow registration point

The registration point must keep **each platform's Connect module + routes isolated** — CLAUDE.md §3.7 makes each OAuth provider an isolation boundary, and the auto-memory records that Airtable OAuth has previously *regressed* from storage-provider work when isolation eroded. A shared "generic OAuth" abstraction here would re-introduce exactly that failure mode, so the registration point is a **thin descriptor/index, not a shared flow**.

Airtable's existing layout is the template to preserve, one directory per platform:
- **Routes:** `apps/web/src/pages/api/connections/airtable/{start,callback,disconnect,_engine-status}.ts` → a second platform gets `apps/web/src/pages/api/connections/zite/{start,callback,disconnect}.ts`, structurally parallel, sharing no handler.
- **Module set:** `apps/web/src/lib/airtable/{config,oauth,persist,disconnect,sso,sso-linked,cookie,return-to,success-redirect,client}.ts` → a second platform gets `apps/web/src/lib/zite/*`, its own module set.

The "registration" is a small per-platform descriptor the catalog-gate (§2.3) and the wizard read — `{ slug, connectStartPath, hasAdapter }` — that *names* each platform's already-isolated routes; it does not fold them into one flow. Adding a provider also triggers the CLAUDE.md §3.7 same-change obligation to update `shared/internal/oauth-setup.md` (new §3.N subsection + callback-path table + gap checklist) — tasks.md §7.2.

### §2.5 Payload-schema strategy — the primary open question (D6)

The `bo_at_*` / `at_*` schema (§1.1 chokepoint #6) *is* Airtable's data model. Three ways a second platform can store captured data, with sharply different costs — this is the **single biggest lever** on the §1.4 verdict and is explicitly a founder/architecture decision:

| Option | What it means | Cost | Risk |
|---|---|---|---|
| **(a) Reuse `bo_at_*`** as a generic shape | Treat base/table/field/view/record as platform-neutral containers; store Zite data in the existing tables | Cheapest — **~1 day** schema work (§1.4) *if* Zite maps cleanly (containers → tables → typed cells) | Forces Zite into Airtable's ontology; the `at_` prefix becomes a lie; migration debt if it doesn't fit (§3.3 answers whether it fits) |
| **(b) New `bo_zt_*` schema** | Follow `system-per-space-db`'s own naming rule (the platform `code` prefix, `core.ts:44`; `bo_no_` was reserved for Notion) | Most expensive — **~2 weeks**: dual-dialect authoring (SQLite + Postgres, twice), generated per-table views, per-Space migrations — the same cost `system-per-space-db` paid for Airtable | None to correctness; it's just work |
| **(c) Normalized `bo_src_*`** | One platform-neutral shape all adapters map into | Highest upfront design cost, lowest marginal cost per future platform | The right long-term bet for a serious multi-platform product — but a big architectural bet to make for platform #2 specifically |

**Recommendation:** decide *after* the §3.2 spike reveals how far Zite's model diverges (§3.3), but *before* the payload build (Migration Plan step 7). The estimate range in §1.4 spans (a)↔(b) precisely because this is unresolved.

---

## §3 Zite spike preparation

### §3.1 Zite API-docs request checklist (for the founder)

Three of the six Zite line items (§1.4) cannot be firmed up without these. Each maps to a specific chokepoint the docs must let us build against:

1. **Auth model** — OAuth 2.0 (authorization-code + refresh) vs static API key? Scopes/permission granularity? Token lifetime + refresh semantics? → determines the §2.4 Connect module (chokepoint #1) and whether `platform_config` needs new fields (`core.ts:276-279`).
2. **Schema / metadata API** — is there an endpoint that enumerates containers and returns each container's tables → fields → types (the analog of Airtable's `GET /v0/meta/bases` + `/v0/meta/bases/:id/tables`)? → determines `listContainers` + `getSchema` (§2.1) and whether `schema-diff.ts`'s `EntityType` hierarchy (`schema-diff.ts:18`) survives.
3. **Record listing + pagination** — list-records endpoint, page size limits, and the pagination primitive (cursor/offset/page-number)? Can it filter/select fields? → determines `listRecords` + `ListRecordsOptions` (§2.1).
4. **Rate limits** — requests/sec (per token? per container?), 429 semantics, `Retry-After` support? → determines the adapter's backoff (Airtable's is tuned to 5 req/sec/base, `airtable-client.ts:119-137`).
5. **Field-type taxonomy** — the full list of field/property types and their value shapes (does it have linked-records, multi-select, attachments, formulas, rollups — Airtable's set — or something different?) → determines `normalizeFieldValue`/`denormalizeFieldValue` (§2.1 / chokepoint #4) and is a direct input to §3.3.
6. **Write/restore API** — create-records endpoint, batch limits, typecast/validation behavior? → determines the optional `createRecords` surface (§2.1) and the restore write client (chokepoint #3).

### §3.2 Spike acceptance test (D7)

The interface (§2.1) is only proven when a *second, structurally different* adapter fits it. **Acceptance test:** once §3.1 docs are in hand, implement a **throwaway `sources/zite.ts`** against the `SourcePlatformClient` sketch and confirm all of:

- `listContainers()` expresses Zite's top-level enumeration,
- `getSchema(containerId)` expresses Zite's tables → fields → types in the neutral `SourceSchema` shape (without lossy flattening),
- `listRecords(containerId, tableRef, opts)` expresses Zite's record listing **and its pagination primitive** via `opts.cursor`,
- `normalizeFieldValue` / `denormalizeFieldValue` express Zite's field-type set round-trip,
- (if Zite's API supports writes) `createRecords` expresses Zite's create path.

**Pass** = all five compile and round-trip against the interface with no Airtable-specific escape hatch → freeze the interface, proceed to tasks.md §8. **Fail** = any method needs an Airtable-shaped concept Zite lacks (or vice-versa) → the interface (§2.1) is **refined before freeze**, not patched around mid-build. This de-risks the estimate rather than discovering the mismatch during the real build. The spike is throwaway: it validates the *shape*, it is not the production adapter.

### §3.3 Structural assessment — Airtable-shaped vs document/block-shaped

The decisive question for §2.5 option (a): is Zite a **container → table → typed-record** platform (Airtable-shaped) or a **document/block** platform (Notion-shaped)?

- **If Airtable-shaped** (workspaces/bases → tables → rows → typed columns): Zite maps directly onto the existing entity hierarchy (`schema-diff.ts:18` `"base" | "table" | "field" | "view"`) and the `bo_at_*` EAV storage. **§2.5 option (a) is viable** — the ~1-day payload cost and the low end of the §1.4 verdict are in play, and the `SourcePlatformClient` read shape (§2.1) needs little adjustment.
- **If document/block-shaped** (pages → nested blocks, à la Notion, where "records" are heterogeneous block trees rather than rows in a typed table): the `base/table/field/view` hierarchy does **not** fit, `getSchema` has no clean tables-and-fields answer, and **§2.5 option (a) fails** — a page/block platform needs option (b) (`bo_zt_*`) or (c) (normalized), pushing toward the high end of the §1.4 range. The read client and normalizer estimates also rise.

Zite is marketed as an "AI-native no-code **database**" with ~200k customers, which *suggests* the container→table→typed-record family (Airtable-shaped) — but this is exactly what the §3.2 spike must confirm empirically, not assume. The founder's docs request (§3.1 items 2 + 5) is what turns this from an educated guess into an answer. Until then, the §1.4 estimate is deliberately a range, not a point.

---

## Decisions

These record the rationale behind §2; they are unchanged in intent from the assessment and are retained as the decision log.

### D1 — Reuse the control-plane abstraction as-is; add no new master tables
The `platforms` / `space_platforms` / `connections.platformId` / `subscription_items.platformId` / `resolveCapabilities(platformSlug)` machinery already models multiple platforms (§1.2, cited). This change adds **nothing** to the control plane. Onboarding a platform is: seed a `platforms` row (`slug`, `code`), and the existing joins carry it; capability resolution needs platform-scoped entitlement-catalog rows per `Baseout_Features.md` §3 — a data change, not a schema change. *Consequence:* the "cheap" half is genuinely cheap; the cost is entirely in the execution plane.

### D2 — Introduce a `SourcePlatformClient` adapter interface, mirroring the destination-writers factory
Define the missing seam by copying the shape that already works for destinations (§2.1 / §2.2). *Alternative considered:* leave the concrete client and add `if (platform === 'zite')` branches at each call site — rejected: it re-hardcodes at N sites (the exact anti-pattern chokepoint #7 / §1.3 documents) and has no test seam. The factory is the destination side's proven answer.

### D3 — Catalog gating: a platform is `available` only when its adapter + OAuth flow are registered
§2.3. `SOURCE_PLATFORMS` availability flips `coming_soon` → `available` only when `resolveSourceClient(slug)` and the platform's Connect routes exist — exactly how `getDestinationProviders(env)` gates a BYOS provider on its OAuth client id being configured.

### D4 — Retire hardcoded `platforms.slug = 'airtable'` filters via context resolution
The 24 literals (§1.3) resolve the platform from the Space or Connection they already scope to (the row's `platformId`), or accept a `platformSlug` parameter threaded from the caller — never a string literal. Low-risk, mechanical, high-count; sequenced as its own sweep so it lands incrementally without behavior change (Airtable-only orgs resolve to `'airtable'` exactly as before). The two `eq(platforms.slug, platformSlug)` sites in the capability resolvers (§1.2) are the target pattern.

### D5 — Field-type mapping is a per-adapter hook, not shared logic
`normalizeFieldValue` / `denormalizeFieldValue` move onto the adapter (§2.1). The canonical stored `value` (JSON-encoded, per `system-per-space-db` Decision 9) stays platform-neutral; each adapter owns the map between its native field types and that canonical value. Cleanest of the chokepoints — the boundary is already a pure function (`field-normalizer.ts:12`, `field-denormalizer.ts:41`).

### D6 — Payload-schema strategy is deferred to a founder/architecture decision (three options)
§2.5. The single biggest driver of the weeks-vs-months answer. The estimate (§1.4) is a range across (a)/(b) precisely because this is unresolved.

### D7 — Zite adapter is the spike that validates the interface
§3.2. The design is only proven when a second, structurally different adapter fits it. If it does not, the interface (§2.1) is refined *before* freeze.

## Risks / Trade-offs

- **[Estimate is docs-gated]** Three Zite line items (OAuth, read client, normalizer) cannot be firmed up without Zite API docs (§3.1). The verdict is a range, not a point; it narrows the moment docs arrive (§3.2 spike).
- **[Payload-schema decision dominates]** §2.5 / D6 swings the Zite subtotal by ~2 weeks by itself. Choosing (a) reuse to hit "one month" risks bending Zite into Airtable's ontology and paying migration cost later; choosing (c) normalized is the right long-term bet but the wrong thing to discover you need *during* the platform-#2 build.
- **[Building the seam before V2 is greenlit]** Extracting the `SourcePlatformClient` seam touches core capture code (`backup-base.ts`, schema-diff, collaborators-sync) that is load-bearing for V1 Airtable backups. Doing it speculatively adds regression surface to a working V1 for a V2 that may not ship. Mitigated by: Airtable-adapter-is-a-wrapper (behavior-preserving, §2.2), the existing Vitest suites as the regression net, and sequencing the low-risk filter sweep (§1.3 / D4) independently of the interface extraction.
- **[Per-provider OAuth isolation]** CLAUDE.md §3.7 / the auto-memory record that Airtable OAuth has previously regressed from storage-provider work. The registration point (§2.4) must keep each source platform's OAuth module + routes isolated — a shared "generic OAuth" abstraction here would re-introduce exactly that failure mode. §2.4 deliberately keeps Connect flows per-platform.
- **[Multi-platform Spaces still out]** This makes a *second platform* possible; it does not make *two platforms in one Space* possible (that stays V2 per `system-per-space-db`; `spaces.spaceType` default `'single_platform'` at `core.ts:118`). If the founder's mental model is "one Space, Airtable + Zite side by side," that is a strictly larger change and should be scoped separately.

## Migration Plan

This change is doc/spec only — nothing to migrate. The **implementation** it describes (a future V2 `system-*` change) would sequence to keep V1 shippable throughout:

1. **Assessment sign-off** (this change) + founder decisions on §2.5/D6 (payload schema) and build-now-vs-after-launch.
2. **Filter sweep (§1.3 / D4)** — retire hardcoded `'airtable'` literals via context resolution. Behavior-identical for Airtable-only orgs; independently shippable; lowest risk.
3. **`SourcePlatformClient` interface + factory + Airtable adapter (wrapper)** (§2.1 / §2.2) — extract, don't rewrite; existing suites stay green.
4. **Wire capture consumers** (`backup-base.ts`, schema-diff, collaborators-sync) to the interface.
5. **Per-platform OAuth registration** (§2.4) — extract Airtable's Connect module set behind the registration point; update `oauth-setup.md` same-change.
6. **Zite spike (§3.2 / D7)** against the sketched interface once API docs land; refine the interface if Zite's model doesn't fit before freezing it.
7. **Payload-schema build** per the §2.5/D6 decision (reuse / `bo_zt_*` / normalized).
8. **Zite adapter** (read/write/normalize) + **catalog flip** (`coming_soon` → `available`, §2.3/D3).

Rollback at any step = the adapter for a platform is unregistered; the catalog never lists it; Airtable is unaffected because it is adapter #1 wrapping the unchanged client.

## Open Questions

- **[Founder — payload schema, §2.5/D6]** Does platform #2 (a) reuse `bo_at_*` as a generic container shape, (b) get its own `bo_zt_*` schema, or (c) trigger a normalized `bo_src_*` canonical shape? Biggest single lever on cost. Recommendation: decide after the §3.2 spike reveals how far Zite's model diverges (§3.3) — but before the payload build (Migration Plan step 7).
- **[Founder — timing]** Build the `SourcePlatformClient` seam **now** (optionality against the Bending Spoons acquisition, but adds regression surface to a pre-launch V1) or **after V1 launch** (safer, but the weeks-scale clock only starts then)? The seam is valuable independent of Zite specifically — it is the thing that makes *any* second platform weeks-scale.
- **[Founder — external dependency]** Obtain **Zite API documentation** per the §3.1 checklist. Three of the six Zite line items are blocked on this; the estimate is a range until it arrives.
- **[Architecture]** Is Zite structurally like Airtable (containers → tables → typed records)? If document-/block-shaped (closer to Notion), the read-client and normalizer estimates rise and §2.5 option (a) likely fails. The §3.2 spike + §3.3 assessment answer this.
- **[Product]** Does a second platform imply **multi-platform Spaces** (Airtable + Zite in one Space) or just **per-Space platform choice** (a Space is Zite *or* Airtable)? This design assumes the latter (matches `spaces.spaceType='single_platform'`, `core.ts:118`, + `system-per-space-db`). The former is a strictly larger V2 change.

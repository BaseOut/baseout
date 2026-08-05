# system-platform-abstraction — tasks

This change is an assessment + design artifact (PRD V2 boundary — no V1 implementation). Sections 1–3 are the deliverable of *this* change (assessment, interface design, spike prep). Sections 4–8 are the **scoped-but-not-yet-authorized** implementation plan that the assessment produces — they land under a future V2 `system-*` change only after the founder signs off on the Open Questions (payload schema; build-now-vs-after-launch). All boxes unchecked.

## 1. Readiness assessment (this change)

- [x] 1.1 Catalog every execution-layer chokepoint grouped by layer (OAuth, read client, write client, field (de)normalization, capture pipeline, payload schema, hardcoded query filters), each with `file:line` — captured in design.md "Chokepoint catalog" <!-- 2026-08-05: design.md §1.1 — 7 layers, all file:line verified against live tree (schema-diff EntityType corrected :20→:18; fetchImpl noted as test-not-provider seam) -->
- [x] 1.2 Confirm and cite the already-abstracted control-plane surface (`platforms`, `space_platforms`, `connections.platformId`, `subscription_items.platformId`, `resolveCapabilities(platformSlug)`, `SOURCE_PLATFORMS`) so the assessment credits what exists <!-- 2026-08-05: design.md §1.2 table — all 7 surfaces cited (core.ts:41-51/137-149/118-119/259-261/431; subscription-items.ts:25; resolve.ts server:49,62 web:79,90; provider-catalog.ts:153-158) -->
- [x] 1.3 Enumerate the hardcoded platform literals: count and cite the ~19 `eq(platforms.slug, 'airtable')` filters + JS-side `platformSlug === 'airtable'` checks <!-- 2026-08-05: design.md §1.3 — exact count is 18 SQL + 6 JS = 24 (not ~19); 2 parameterized resolve.ts sites + apps/design EntityPanel tab-name matches excluded; every file:line tabulated -->
- [x] 1.4 Produce the per-chokepoint effort estimate and the weeks-vs-months verdict for adding Zite (design.md "Effort estimate") <!-- 2026-08-05: design.md §1.4 — seam ~2-3wk + Zite adapter ~2.5-5wk = ~6-10 eng-weeks; verdict: weeks-scale (~1mo w/ two engineers, not 6mo), gated on payload-schema decision + Zite docs -->

## 2. Adapter-interface design (this change)

- [x] 2.1 Specify the `SourcePlatformClient` contract (`listBases` / `getSchema` / `listRecords` + restore write surface + `normalizeFieldValue` / `denormalizeFieldValue` hooks), mirroring the destination `StorageWriter` interface <!-- 2026-08-05: design.md §2.1 — TS-shaped spec mirrors storage-writer.ts:12-59; 1:1 rename of AirtableClient (airtable-client.ts:146-154), optional createRecords, field hooks pulled onto adapter -->
- [x] 2.2 Specify the `resolveSourceClient(platformSlug, creds)` dispatch factory + per-platform module registration, mirroring `resolveStorageWriter` / `storage-writers/index.ts` <!-- 2026-08-05: design.md §2.2 — mirrors resolveStorageWriter (index.ts:51-75) incl. discriminated-union creds; sources/<slug>.ts modules; throws (not falls back) on unregistered platform -->
- [x] 2.3 Specify catalog gating: `SOURCE_PLATFORMS` availability governed by adapter + OAuth-flow registration, mirroring `getDestinationProviders(env)` env-gating <!-- 2026-08-05: design.md §2.3 — getSourcePlatforms(gate) over SOURCE_PLATFORMS (provider-catalog.ts:153-158), symmetric to getDestinationProviders (:165-174); available iff adapter ∧ oauth registered -->
- [x] 2.4 Specify the per-platform OAuth-flow registration point (keeping each platform's Connect module + routes isolated per CLAUDE.md §3.7) <!-- 2026-08-05: design.md §2.4 — thin descriptor, NOT a shared flow; cites airtable route+module layout (connections/airtable/*, lib/airtable/*); §3.7 isolation + oauth-setup.md same-change obligation -->
- [x] 2.5 Document the three payload-schema strategies (reuse `bo_at_*` / new `bo_zt_*` / normalized `bo_src_*`) and their cost deltas; flag as the primary open question <!-- 2026-08-05: design.md §2.5 — cost table (a ~1day / b ~2wk / c highest-upfront); flagged as primary open question + Open Questions §2.5/D6 -->


## 3. Zite spike preparation (this change)

- [x] 3.1 Draft the Zite API-docs request checklist for the founder (auth model, schema/metadata API, record listing + pagination, rate limits, field-type taxonomy) <!-- 2026-08-05: design.md §3.1 — 6-item checklist, each item mapped to the chokepoint it unblocks (incl. write/restore API) -->
- [x] 3.2 Define the spike acceptance test: a throwaway `sources/zite.ts` must express `listBases/getSchema/listRecords` + field-type hooks against the `SourcePlatformClient` sketch, or the interface is refined before freeze (D7) <!-- 2026-08-05: design.md §3.2 — 5 pass criteria (3 read + 2 field hooks + optional createRecords); pass=freeze→§8, fail=refine interface before freeze -->
- [x] 3.3 Assess whether Zite is structurally Airtable-shaped (containers → tables → typed records) vs document/block-shaped, and its impact on payload-schema option (a) <!-- 2026-08-05: design.md §3.3 — Airtable-shaped ⇒ option (a) viable (low end); document/block-shaped (Notion-like) ⇒ (a) fails, forces (b)/(c) (high end); "AI-native database" suggests Airtable-shaped but spike must confirm -->


--- everything below is the future V2 implementation plan (NOT authorized by this change) ---

## 4. Filter sweep — retire hardcoded platform identity

- [ ] 4.1 Replace `eq(platforms.slug, 'airtable')` in `apps/server` (`SpaceDO.ts:630`, `rediscovery/run-deps.ts:102`, `cron/oauth-refresh-deps.ts:79,128,215`, `register-webhooks.ts:133`, `token-health.ts:49,61`) with context/param-resolved platform
- [ ] 4.2 Replace the same literal in `apps/web` (`integrations.ts:139,169`, `airtable/{disconnect,persist,sso-linked}.ts`, `spaces/[spaceId]/{workspaces,restore,rescan-bases,backup-runs}.ts`) and the JS-side `dashboard.ts:25` check
- [ ] 4.3 Replace it in `apps/admin` (`actions/force-backup.ts:118`)
- [ ] 4.4 Verify behavior is byte-identical for Airtable-only orgs (existing suites green; the resolved platform is `'airtable'` exactly as before)

## 5. Source-provider adapter seam

- [ ] 5.1 Author the `SourcePlatformClient` interface + `resolveSourceClient` factory (mirror `storage-writers/`), TDD
- [ ] 5.2 Implement the Airtable adapter as a thin wrapper over the existing `airtable-client.ts` (behavior-preserving extract; existing Airtable suite stays green)
- [ ] 5.3 Move `normalizeFieldValue` / `denormalizeFieldValue` onto the adapter as per-platform hooks
- [ ] 5.4 Extract the write (restore) surface (`airtable-create.ts`) behind the adapter

## 6. Wire capture consumers to the interface

- [ ] 6.1 `backup-base.ts` calls `resolveSourceClient(platformSlug, creds)` instead of importing `createAirtableClient` directly
- [ ] 6.2 `schema-diff.ts` takes the neutral `SourceSchema` shape (not Airtable's `getBaseSchema` shape)
- [ ] 6.3 `collaborators-sync.ts` takes a neutral collaborator shape (or is declared Airtable-only if the second platform has no equivalent)

## 7. Per-platform OAuth registration

- [ ] 7.1 Extract Airtable's Connect module set (`apps/web/src/lib/airtable/*` + `apps/web/src/pages/api/connections/airtable/*`) behind the registration point, keeping the module isolated
- [ ] 7.2 Update `shared/internal/oauth-setup.md` per CLAUDE.md §3.7 (new provider = new §3.N subsection + callback-path table + gap checklist) — same-change rule

## 8. Second platform (Zite) — gated on §3 docs + payload-schema decision

- [ ] 8.1 Seed the `platforms` row + entitlement catalog rows for Zite (control-plane data only, per D1)
- [ ] 8.2 Payload schema per the D6 decision (reuse / `bo_zt_*` / normalized)
- [ ] 8.3 Zite OAuth/Connect module + routes
- [ ] 8.4 Zite read client (`SourcePlatformClient` impl) + field normalize/denormalize
- [ ] 8.5 Zite write client (restore)
- [ ] 8.6 Flip `SOURCE_PLATFORMS` Zite `coming_soon` → `available` (D3); wizard/dashboard platform-awareness
- [ ] 8.7 E2E: connect a Zite account, run a backup, verify capture + restore round-trip

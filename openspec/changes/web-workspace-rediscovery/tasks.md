## Phase 1 — Rescan button + engine proxy

### 1.1 — Engine client

- [x] 1.1.1 Add `rescanBases(spaceId)` to [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts). Returns `EngineRescanBasesResult` discriminated union.
- [x] 1.1.2 Map engine HTTP response to the typed result. Surface engine HTTP failures (binding unreachable, INTERNAL_TOKEN mismatch) as `engine_unreachable`.

### 1.2 — Route handler

- [x] 1.2.1 New file [apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts) — exports `POST`, `handlePost`, `SpaceRowSlim`, `HandlePostInput`, `statusForEngineError`.
- [x] 1.2.2 Auth check (`locals.account?.organization?.id`) — 401 on missing.
- [x] 1.2.3 UUID validation — 400 on malformed `spaceId`.
- [x] 1.2.4 IDOR check (Space row → org match) — 403 on mismatch.
- [x] 1.2.5 Service binding + INTERNAL_TOKEN missing — 503 with `server_misconfigured`.
- [x] 1.2.6 Engine error mapping per `statusForEngineError`.
- [x] 1.2.7 GET/PUT/PATCH/DELETE → 405.

### 1.3 — Tests

- [x] 1.3.1 New file [apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.test.ts) — covers 401, 400 (no spaceId / non-UUID), 403 (no Space, Org mismatch), 503 (no binding), all engine error mappings, and the happy 200 path.
- [ ] 1.3.2 Run `pnpm --filter @baseout/web test rescan-bases` — green.

## Phase 2 — Banner state hydration

### 2.1 — Type addition

- [x] 2.1.1 Add `SpaceEventSummary` interface to [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/connections.ts) — `id`, `kind: 'bases_discovered'`, `createdAt: string`, `payload`.
- [x] 2.1.2 Extend `IntegrationsState` to include `unreadEvents: SpaceEventSummary[]` and `autoAddFutureBases: boolean`.

### 2.2 — State hydration

- [x] 2.2.1 [apps/web/src/lib/integrations.ts](../../../apps/web/src/lib/integrations.ts) — query unread `space_events` with `dismissed_at IS NULL`, ordered DESC by `created_at`, LIMIT 10.
- [x] 2.2.2 Filter to `kind = 'bases_discovered'` and map payload arrays defensively (`Array.isArray` guards on each field).
- [x] 2.2.3 Add `autoAddFutureBases` to the SELECT against `backup_configurations`.
- [ ] 2.2.4 Run `pnpm --filter @baseout/web typecheck` — green.

## Phase 3 — Banner UI + dismiss endpoint

### 3.1 — IntegrationsView banner

- [x] 3.1.1 [apps/web/src/views/IntegrationsView.astro](../../../apps/web/src/views/IntegrationsView.astro) — render banner when `unreadEvents[0]` exists.
- [x] 3.1.2 Banner copy: discovered / autoAdded / blockedByTier counts; hide zero-count subclauses.
- [x] 3.1.3 "Rescan bases" button — wires to `setButtonLoading` per [apps/web/.claude/CLAUDE.md §12](../../../apps/web/.claude/CLAUDE.md).
- [x] 3.1.4 "Dismiss" button — calls dismiss endpoint and hides the banner.
- [ ] 3.1.5 Mobile responsiveness — banner stacks vertically at < 640px width.

### 3.2 — Dismiss endpoint

- [x] 3.2.1 New file [apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.ts) — POST only.
- [x] 3.2.2 Auth, IDOR, event-belongs-to-space checks per design.md §Phase 3.
- [x] 3.2.3 Idempotent UPDATE with `dismissed_at IS NULL` predicate.

### 3.3 — Dismiss tests

- [x] 3.3.1 New file [apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.test.ts) — covers 401, 403, 404 (non-existent event), 404 (event-not-in-space), 200 (happy), 200 (already dismissed).
- [ ] 3.3.2 Run `pnpm --filter @baseout/web test dismiss` — green.

## Phase 4 — Auto-add toggle persistence

### 4.1 — Policy extension

- [x] 4.1.1 [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts) — add `autoAddFutureBases?: boolean` to body schema + UpsertConfigInput.
- [x] 4.1.2 Validate as `typeof v === 'boolean'`; reject otherwise as `invalid_request`.
- [x] 4.1.3 Empty-body case rejects only if all three fields absent.
- [x] 4.1.4 Pass through to `upsertConfig`.

### 4.2 — Policy tests

- [x] 4.2.1 [apps/web/src/lib/backup-config/persist-policy.test.ts](../../../apps/web/src/lib/backup-config/persist-policy.test.ts) — new branches: bool-only body, bool with frequency, bool with storageType, type mismatch (number), empty body.
- [ ] 4.2.2 Run `pnpm --filter @baseout/web test persist-policy` — green.

### 4.3 — IntegrationsView toggle

- [x] 4.3.1 Toggle control bound to `autoAddFutureBases` state.
- [x] 4.3.2 On change → PATCH `/api/spaces/:id/backup-config` with `{ autoAddFutureBases }`.
- [x] 4.3.3 Optimistic store update, rollback on non-2xx (same pattern as storage-type picker).
- [ ] 4.3.4 Loading state via `setButtonLoading` (or equivalent toggle-loading helper).

## Verification

- [ ] All tests green: `pnpm --filter @baseout/web test rescan-bases dismiss persist-policy integrations`.
- [ ] Typecheck green: `pnpm --filter @baseout/web typecheck`.
- [ ] Build green: `pnpm --filter @baseout/web build`.
- [ ] No stray `console.*` or `debugger`: `git diff --staged | grep -E '(console\\.|debugger)'` empty per [apps/web/.claude/CLAUDE.md §5](../../../apps/web/.claude/CLAUDE.md).
- [ ] Smoke: connect Airtable workspace → add a base to Airtable → click Rescan in Integrations → banner shows new base → dismiss → banner gone. Repeat with auto-add toggled on; verify the base appears in `backup_configuration_bases`.
- [ ] Tier-cap edge case: with toggle on and at-cap, the banner shows `blockedByTier` count > 0 and the discovered bases are not auto-added.

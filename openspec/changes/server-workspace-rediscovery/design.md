## Overview

Three phases. Phase 1 (schema) shipped in `3eeedfb`. Phase 2 (this change) adds the pure orchestrator + dep wiring + manual rescan route. Phase 3 (deferred) integrates the SpaceDO alarm.

The architectural call is **a single pure-function orchestrator behind a deps interface**. Both rediscovery entry points (manual route now, SpaceDO alarm later) route through `runWorkspaceRediscovery` so the auto-add + tier-cap policy stays consistent. If we'd written two separate handlers, the alarm path would inevitably drift from the manual path the first time someone changed the cap-handling rule. One orchestrator + one deps interface = one policy.

## Phase 2 design

### Pure orchestrator shape

```ts
// apps/server/src/lib/rediscovery/run.ts

export interface RediscoveryInput {
  spaceId: string
  configId: string
  organizationId: string
  triggeredBy: 'alarm' | 'manual'
}

export interface WorkspaceRediscoveryDeps {
  fetchKnownAtBaseIds: (spaceId: string) => Promise<Set<AtBaseId>>
  fetchAutoAddToggle: (configId: string) => Promise<boolean>
  fetchIncludedBaseCount: (configId: string) => Promise<number>
  listAirtableBases: () => Promise<AirtableBaseSummary[]>
  upsertAtBases: (rows, opts) => Promise<void>
  resolveTierCap: (organizationId: string) => Promise<number | null>
  enableBackupConfigurationBases: (configId, atBaseIds) => Promise<void>
  insertSpaceEvent: (spaceId, event) => Promise<void>
  now: () => Date
  logger: { info, warn, error }
}

export interface RediscoveryResult {
  discovered: number
  autoAdded: number
  blockedByTier: number
}

export async function runWorkspaceRediscovery(
  input: RediscoveryInput,
  deps: WorkspaceRediscoveryDeps,
): Promise<RediscoveryResult>
```

### Algorithm

1. List Airtable workspace bases.
2. Upsert **every** listed base (not just the fresh ones) so `last_seen_at` bumps on known bases — this is how the system records "this base still exists in the workspace." On insert, set `discovered_via` from the trigger source (`'rediscovery_scheduled'` or `'rediscovery_manual'`). On conflict, update `name` + `last_seen_at` only; `discovered_via` is preserved.
3. Compute the fresh-set: listed bases whose `at_base_id` is not in the known set.
4. If no fresh bases: return `{ discovered: 0, autoAdded: 0, blockedByTier: 0 }`. No `space_events` row (nothing to surface).
5. If `auto_add_future_bases = false`: insert one `space_events` row with `{ discovered, autoAdded: [], blockedByTier: [], tierCap }`. The banner explains "N bases discovered; auto-add is off; turn it on to include them." Return without modifying `backup_configuration_bases`.
6. If `auto_add_future_bases = true`:
   - Resolve the tier `basesPerSpace` cap. `null` = enterprise = unlimited.
   - Count currently-included bases for this config. Available slots = `cap - count` (or `Infinity` for enterprise).
   - Split the fresh list: first `allowed` get auto-added; the rest are `blockedByTier`.
   - Insert `backup_configuration_bases` rows for `willAutoAdd` with `is_included = true, is_auto_discovered = true`.
   - Insert the `space_events` row with the breakdown.
7. Return the counts.

### Why upsert all bases (step 2)

Storing `last_seen_at` per base costs one column and one UPDATE per rediscovery. It lets a future "stale base" cron prune bases that disappeared from the workspace — without storing the last-seen timestamp, we'd have no signal for that. The data is cheap and the option-value is real.

### Production dep wiring shape

```ts
// apps/server/src/lib/rediscovery/run-deps.ts

export type BuildRediscoveryDepsResult =
  | { ok: true; context: { configId; organizationId }; deps: WorkspaceRediscoveryDeps }
  | { ok: false; error: 'space_not_found' | 'config_not_found' | 'connection_not_found' }

export async function buildRediscoveryDeps(
  input: { db; spaceId; triggeredBy; encryptionKey },
): Promise<BuildRediscoveryDepsResult>
```

Four discriminated outcomes:
- `space_not_found` — Space row missing → route returns 404.
- `config_not_found` — Space has no `backup_configurations` row → 404. (Note: a fresh OAuth callback should always create one. If we land here in production, that flow is broken.)
- `connection_not_found` — Org has no active Airtable connection → 409 (caller can prompt to reconnect).
- `ok` — proceed to `runWorkspaceRediscovery`. Errors thrown from inside the orchestrator (`AirtableError`, decryption failures) surface as 502 at the route boundary.

### Capability resolver

[apps/server/src/lib/capabilities/](../../../apps/server/src/lib/capabilities/) is a mirror of [apps/web/src/lib/capabilities/](../../../apps/web/src/lib/capabilities/). The canonical writer is `apps/web`; the engine copy exists so rediscovery doesn't round-trip through Stripe per [CLAUDE.md §5.3](../../../CLAUDE.md). The mirror is justified by hot-path latency: rediscovery runs synchronously inside a POST handler, and a Stripe metadata read would add ~150ms per call.

Drift between the canonical and engine copies would silently miscount the cap. Mitigations:
- Header comment in both files referencing the other.
- Future: extract to `@baseout/db-schema` or a shared `@baseout/shared/capabilities` package. Out of scope for this change per the specreview deferral.

### Route shape

```
POST /api/internal/spaces/:spaceId/rescan-bases
Header: x-internal-token: $INTERNAL_TOKEN

Response 200 OK
{ "ok": true, "discovered": 3, "autoAdded": 2, "blockedByTier": 1 }

Response 400 Bad Request    { "error": "invalid_request" }      // non-UUID spaceId
Response 401 Unauthorized   (handled by middleware)
Response 404 Not Found      { "error": "space_not_found" | "config_not_found" }
Response 405 Method Not Allowed { "error": "method_not_allowed" }
Response 409 Conflict       { "error": "connection_not_found" }  // Space's Org has no active Airtable Connection
Response 502 Bad Gateway    { "error": "airtable_error", "upstream_status": 503 }
```

### Tests

Two integration test files, both Vitest, both untracked on the branch:

1. [tests/integration/rediscovery-run.test.ts](../../../apps/server/tests/integration/rediscovery-run.test.ts) — pure-fn coverage using `vi.fn()` deps. Six branches.
2. [tests/integration/spaces-rescan-bases-route.test.ts](../../../apps/server/tests/integration/spaces-rescan-bases-route.test.ts) — route shape under Miniflare. Covers 401 (no token), 405 (GET), 400 (non-UUID), 404 / 409 / 502 (mapped resolved errors), 200 (happy path).

### Concurrency

Two concurrent rescans for the same Space converge:
- `at_bases` INSERT…ON CONFLICT — either wins, `last_seen_at` ends up at the latest of the two.
- `backup_configuration_bases` INSERT…ON CONFLICT — either wins, `is_included` ends up `true` regardless.
- `space_events` is append-only — both rows land. The banner shows the most recent one; older ones are harmless (the UI lists up to 10 unread).
- Read-after-write: the second rescan reads `at_bases` after the first has committed, so its `known` set already contains the first's writes. Its `fresh` set will be smaller (potentially empty); it inserts a second `space_events` row with `discovered: []` which the banner-render step ignores.

In other words: idempotent at every step. No locking required.

### What's intentionally NOT done

- **No `at_bases` tombstoning when a base disappears from the workspace.** We only bump `last_seen_at`. A future cron can use that timestamp to disable backup for vanished bases. Adding it here would expand scope to handle the "what if the customer recreated a deleted base with the same name?" question, which doesn't belong in this change.
- **No retry on transient Airtable errors.** A failed rescan surfaces a 502 to the caller; the user clicks again. The alarm path (Phase 3) will need its own retry-with-backoff design.
- **No rate-limit budget integration via `ConnectionDO`.** This is one Meta API call. Worth revisiting if a future change makes rediscovery a hot path.

## Open questions

1. **Should rediscovery write to `space_events` even when zero fresh bases were found?** Today: no (algorithm step 4 short-circuits). The banner only shows on actual discovery. Alternative: write an "all known bases still present" event for observability. Decision: stay no-write for V1; revisit if the alarm path (Phase 3) needs visibility.
2. **Should auto-add ever re-include a previously-disabled base?** Today: yes — the orchestrator INSERTs `is_included = true` on conflict. If a user previously explicitly disabled a base, rediscovery would re-enable it. Decision: defer to a future change; the current behavior is the simplest correct one and matches "auto-add is on, include this base," but it could be surprising.
3. **Auto-add tier cap: deterministic order or sorted by name?** Today: orchestrator processes the Airtable listing in returned order (which is by base creation time, not stable across re-fetches if names change). If we ship the cap, two near-simultaneous rescans on a Space with 6 fresh bases at a 5-cap might auto-add different 5 each time. Decision: accept for V1; the user can manually pick the cap'd-off base in the UI.

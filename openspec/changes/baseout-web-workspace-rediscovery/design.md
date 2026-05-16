## Overview

Four phases. Each is a thin slice that surfaces one piece of the engine work to the user. The rescan route + dismiss endpoint are the two new HTTP surfaces; the rest is state hydration + view wiring.

The architectural call worth pinning: **the dismiss writer is `apps/web`, the rediscovery writer is `apps/server`.** Both write to the same `space_events` table. Drift-risk is low because they touch disjoint columns (engine writes `space_id, kind, payload, created_at`; web writes `dismissed_at`).

## Phase 1 — Rescan proxy

The shape is identical to the existing `POST /api/spaces/:id/backup-config` route — auth → IDOR → engine call → response mapping. The only novel piece is the engine-error mapping for `connection_not_found` (mapped to 409, distinct from 404 because it has a different remediation: reconnect rather than retry).

```ts
// apps/web/src/lib/backup-engine.ts (additions)

export type EngineRescanBasesResult =
  | { ok: true; discovered: number; autoAdded: number; blockedByTier: number }
  | { ok: false; code: 'space_not_found' | 'config_not_found' | 'connection_not_found' | 'airtable_error' | 'engine_unreachable' | 'unauthorized' | 'invalid_request' }

interface BackupEngineClient {
  rescanBases(spaceId: string): Promise<EngineRescanBasesResult>
  // ...existing methods
}
```

The status mapping at the route layer is centralised in a single function so future engine errors get a single edit:

```ts
function statusForEngineError(code: string): number {
  switch (code) {
    case 'unauthorized': return 401
    case 'invalid_request': return 400
    case 'space_not_found':
    case 'config_not_found': return 404
    case 'connection_not_found': return 409
    case 'airtable_error':
    case 'engine_unreachable': return 502
    default: return 500
  }
}
```

## Phase 2 — Banner state hydration

`space_events` is queried in `getIntegrationsState`, which already returns the per-Space integrations payload that hydrates the nanostore. Adding events to this read path means the banner appears on initial SSR with no client roundtrip — exactly the UX you want for a notification surface.

```ts
const eventRows = await db
  .select({
    id: spaceEvents.id,
    kind: spaceEvents.kind,
    payload: spaceEvents.payload,
    createdAt: spaceEvents.createdAt,
  })
  .from(spaceEvents)
  .where(
    and(
      eq(spaceEvents.spaceId, spaceId),
      isNull(spaceEvents.dismissedAt),
    ),
  )
  .orderBy(desc(spaceEvents.createdAt))
  .limit(10)
```

The partial index on the table (`(space_id) WHERE dismissed_at IS NULL`) keeps this read cheap regardless of how many dismissed events accumulate.

The `LIMIT 10` is defensive; the banner only renders the first row. The remaining nine give the UI room to grow into a stacked-events view without a query change.

## Phase 3 — Dismiss endpoint

The endpoint is **per-event** (`/space-events/[eventId]/dismiss`) rather than batch (`/space-events/dismiss` with a body of IDs). One event at a time matches the UI (a single banner shows a single event); batching is a future concern when stacked events arrive.

The IDOR check has two layers:

1. The Space's Org matches the session's Org.
2. The event's `space_id` matches the URL `spaceId`.

Layer 2 prevents an evil request from dismissing a stranger's events even if the attacker has access to *some* Space. Without this check, the SQL UPDATE would fire and the attacker would silently dismiss an event in another Space they had no business touching.

```ts
const [event] = await db
  .select({ id: spaceEvents.id, spaceId: spaceEvents.spaceId })
  .from(spaceEvents)
  .where(eq(spaceEvents.id, eventId))
  .limit(1)
if (!event || event.spaceId !== spaceId) {
  return 404 // don't disclose existence
}
```

Update is idempotent — re-dismissing returns 200 with no DB change. This makes the UI safe to retry on transient network errors.

## Phase 4 — Auto-add toggle persistence

The existing `PATCH /api/spaces/:id/backup-config` route already has a generic body validator. Extending it to accept `autoAddFutureBases: boolean` is a 5-line diff in `persist-policy.ts`. Validation rules:

- Type must be `boolean` exactly (no truthy strings, no `0/1`).
- Body may contain `autoAddFutureBases` alone (no other field changes).
- The empty body case stays an error.
- No tier-gating at the persist layer — the engine handles the tier check at rediscovery time (it just won't auto-add past the cap). This keeps the toggle UX symmetric across tiers; enterprise users can flip the toggle and have it work; starter users flip it and discover they hit the cap when bases come in.

The IntegrationsView wires a simple checkbox-style toggle. Server-side write fires on toggle change; UI optimistically updates the nanostore but rolls back on a non-2xx response (the existing pattern from the storage-type picker covers this).

## Open questions

1. **Should the rescan button be debounced?** Today: no — the engine call is one Airtable Meta API request + a few DB writes. A user spam-clicking causes a small flurry of identical work that the orchestrator handles idempotently. If we see this in operational testing, add a 5-second client-side cooldown.
2. **Show "last rescanned" timestamp?** Today: no — `at_bases.last_seen_at` is the data, but surfacing it adds UI scope that doesn't change behavior. Defer.
3. **Banner placement?** First pass: top of the bases list section. Alternatives: under the page title, inside a notification tray. The bases-list location is closest to the action the user takes next (selecting which discovered bases to include), so it stays there for V1.

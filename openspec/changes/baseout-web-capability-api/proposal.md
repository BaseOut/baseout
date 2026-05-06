## Why

Capability resolution exists today as a library — [`apps/web/src/lib/capabilities/resolve.ts`](../../../apps/web/src/lib/capabilities/resolve.ts) reads `subscription_items.tier` joined to `subscriptions` for an org+platform and returns a `ResolvedCapabilities` object. **Every page that needs to gate UI on tier currently has to call `resolveCapabilities()` directly inside its server-side props block**, hitting the master DB on every render.

That's three problems:

1. **No HTTP surface.** Client-side islands can't read capabilities — they have to wait for the next page navigation, or the server has to embed them in a `<script type="application/json">` per page (one-off per page).
2. **No caching.** Tier changes via Stripe webhooks are rare (multi-day cadence), but resolution runs on every render. PRD §13 implies a 5-minute cache is acceptable; Features §5.5.6 says product metadata is the canonical source and the cached `tier` column is kept in sync by webhook handlers — so resolution is read-only and idempotent.
3. **No middleware enforcement helper.** Routes that need to gate on a capability (e.g. "Direct SQL" requires Pro+) have to inline the `resolveCapabilities()` call + tier-comparison logic. Drift between routes is inevitable.

This change adds the missing HTTP surface, a 5-minute in-memory cache, and an `enforceCapability()` helper for routes — without changing the resolver library itself.

This is the seed of `baseout-web/tasks.md` §3.3 (`baseout-web-capability-api`), pulled forward to today's evening sprint because it unblocks future tier-gating UI work (PRD §6 dashboard widgets, PRD §10 SQL access, Features §11 BYOS storage).

## What Changes

- **Add** `GET /api/me/capabilities` — returns the resolved capabilities for the currently authenticated user's active organization, scoped to the Airtable platform (V1 only). Response body is `{ tier: Tier | null, hasSubscription: boolean, capabilities: TierCapabilitySet }` matching `ResolvedCapabilities`.
- **Add** an in-memory cache keyed by organizationId + platformSlug, TTL 5 minutes, with explicit `invalidateCapabilityCache(organizationId)` for use by the future Stripe webhook receiver (`baseout-web-stripe-full`). The cache is per-isolate (Workers don't have shared memory across regions); a 5-min TTL bounds staleness.
- **Add** `enforceCapability()` middleware helper — given a request and a predicate over `TierCapabilitySet`, returns either the resolved capabilities or a 403 `Response`. Drop-in for future API routes that gate on tier.
- **Tests**: cache TTL behavior, eviction on invalidation, predicate evaluation in enforce helper. Unit only — no integration test (the resolver itself is already covered).

## Capabilities

### New Capabilities

- `web-capability-api` — public HTTP endpoint + cache + enforcement helper for tier-gated UI/route decisions on `apps/web`. Spec: [specs/web-capability-api/spec.md](./specs/web-capability-api/spec.md).

### Modified Capabilities

None at the spec level. The resolver library's contract is unchanged.

## Impact

- New file: [apps/web/src/lib/capabilities/cache.ts](../../../apps/web/src/lib/capabilities/cache.ts) — tiny in-memory cache wrapper.
- New file: [apps/web/src/lib/capabilities/enforce.ts](../../../apps/web/src/lib/capabilities/enforce.ts) — middleware helper.
- New file: [apps/web/src/pages/api/me/capabilities.ts](../../../apps/web/src/pages/api/me/capabilities.ts) — `GET` route.
- New file: [apps/web/src/lib/capabilities/cache.test.ts](../../../apps/web/src/lib/capabilities/cache.test.ts) — unit tests (co-located per existing convention).
- No DB changes. No new secrets. No external API. No `apps/server` interaction.

## Reversibility

Fully reversible. The endpoint and cache are net-new; existing `resolveCapabilities()` callers are untouched. Reverting deletes the four new files.

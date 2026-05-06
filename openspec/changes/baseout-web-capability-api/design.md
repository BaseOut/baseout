## Context

Capability resolution today is a library function; this change adds an HTTP surface, a cache, and an enforcement helper. The change is small but the design choices ripple into every future tier-gating route, so they're worth pinning down.

## Goals

- One canonical HTTP surface for "what tier is this org and what can they do?".
- 5-minute cache that hides DB load on render hot-path without making capability changes feel laggy.
- Drop-in enforcement helper for routes that gate on tier (DRY across the codebase).

## Non-Goals

- Stripe webhook receiver (`baseout-web-stripe-full` — separate change).
- Cache invalidation on subscription change (depends on the webhook receiver; deferred until the receiver lands. Until then, the 5-min TTL bounds staleness — acceptable per PRD §13.1).
- Cross-region cache (Cloudflare Workers don't share memory across colos; per-isolate is the only realistic option for an in-memory cache. KV is overkill for a 5-min TTL on a tiny payload).
- Tier-comparison logic in `enforce()` beyond predicate-on-capabilities (specifying that "Pro+ only" or similar lives in caller code, not in the helper, until a second real call site exists).

## Decisions

### D1 — Cache shape: per-(orgId, platformSlug) → ResolvedCapabilities

Keyed by `${organizationId}:${platformSlug}` so a single org with two platforms (V2) doesn't collide. Today only `airtable` is in scope; the key shape leaves room.

**Why:** matches the resolver's input shape exactly; no transformation overhead.

### D2 — TTL: 5 minutes (300_000 ms)

**Why:** PRD §13 implies authentication caches at this cadence. Capability data changes only via Stripe webhooks (multi-day cadence in practice). 5 minutes is well below any user-perceptible window for a capability flip.

### D3 — `enforceCapability(predicate)` returns `Response | TierCapabilitySet`

The helper signature:

```ts
export async function enforceCapability(
  ctx: { locals: App.Locals },
  platformSlug: string,
  predicate: (caps: TierCapabilitySet) => boolean,
): Promise<TierCapabilitySet | Response>
```

Caller pattern:

```ts
const caps = await enforceCapability(ctx, 'airtable', (c) => c.basesPerSpace !== null || c.basesPerSpace > 25);
if (caps instanceof Response) return caps;
// continue with caps...
```

**Why:** TS-friendly union return type means no thrown errors crossing async boundaries; callers handle both shapes explicitly. Predicate is data-only — no string-magic tier names anywhere.

**Trade-off:** `Response` and `TierCapabilitySet` aren't structurally similar, so `instanceof Response` is unambiguous. Acceptable.

### D4 — Endpoint requires authentication; 401 if no `locals.account`

The middleware already gates non-public routes; `/api/me/capabilities` is not in `PUBLIC_PATHS`, so the middleware redirects unauthenticated requests to `/login` for browser navigation. For programmatic API calls without a session cookie, the route handler itself emits `401`.

### D5 — Response shape mirrors `ResolvedCapabilities` 1:1

```ts
{ tier: Tier | null, hasSubscription: boolean, capabilities: TierCapabilitySet }
```

**Why:** the library type is already shaped for client consumption; no per-route DTO needed. Future capability fields added to `TierCapabilitySet` automatically flow to clients.

### D6 — Cache uses a module-scope `Map`, not the existing SESSION_CACHE

[`apps/web/src/lib/session-cache.ts`](../../../apps/web/src/lib/session-cache.ts) is keyed by session token. Capability cache must be keyed by organization ID — different cache, different lifecycle. Cloning the pattern (Map + TTL + invalidate helper) keeps the semantics aligned without coupling the two caches.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | Stale capability after Stripe webhook updates `subscription_items.tier` | Medium | TTL bounds at 5 min. `invalidateCapabilityCache(orgId)` exposed for the future `baseout-web-stripe-full` change to call. |
| R2 | Multiple orgs in same isolate cause memory growth | Low | Map size is bounded by active-org count per isolate; CF isolates are short-lived. No explicit eviction needed for V1. |
| R3 | Predicate-based enforce is awkward when many routes want "Pro+ tier" | Low | Wait for a second real call site before extracting `enforceTierAtLeast(tier)`. |

## Verification

```bash
pnpm --filter @baseout/web typecheck         # 0 errors
pnpm --filter @baseout/web build              # clean
pnpm --filter @baseout/web test:unit          # all green; new cache.test.ts included
```

End-to-end (operator, dev server):

```
curl -i -b 'better-auth.session_token=<valid>' https://localhost:4331/api/me/capabilities
# Expect 200 with JSON { tier, hasSubscription, capabilities: { basesPerSpace } }

curl -i https://localhost:4331/api/me/capabilities
# Expect 401 (no session cookie)
```

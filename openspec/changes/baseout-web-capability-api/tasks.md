# Tasks — baseout-web-capability-api

Single-day scope. ≤ 30 minutes focused work.

## 1 — Cache module

- [ ] 1.1 Create [apps/web/src/lib/capabilities/cache.ts](../../../apps/web/src/lib/capabilities/cache.ts):
  - Module-scope `Map<string, { value: ResolvedCapabilities; expiresAt: number }>`.
  - Key: `${organizationId}:${platformSlug}`.
  - TTL: `5 * 60 * 1000` (export as a named constant for tests).
  - Exports: `getCachedCapabilities(orgId, platformSlug)`, `setCachedCapabilities(orgId, platformSlug, value)`, `invalidateCapabilityCache(orgId, platformSlug?)`, `CAPABILITY_CACHE_TTL_MS`.
  - Invalidate helper: when `platformSlug` is omitted, drop every entry for that org.
- [ ] 1.2 Create [apps/web/src/lib/capabilities/cache.test.ts](../../../apps/web/src/lib/capabilities/cache.test.ts) — unit tests for: cache hit, cache miss, TTL expiry (use `vi.useFakeTimers()`), invalidation by platform, invalidation by org-only.

## 2 — Enforce helper

- [ ] 2.1 Create [apps/web/src/lib/capabilities/enforce.ts](../../../apps/web/src/lib/capabilities/enforce.ts):
  - Exports `enforceCapability(ctx, platformSlug, predicate)` returning `Promise<TierCapabilitySet | Response>`.
  - Reads `ctx.locals.account.organization.id` — returns 401 Response when absent.
  - Calls cache, falls back to `resolveCapabilities()` from [resolve.ts](../../../apps/web/src/lib/capabilities/resolve.ts), populates cache on miss.
  - Predicate failure: returns `403` Response with body `{ error: 'Capability denied' }`.

## 3 — HTTP route

- [ ] 3.1 Create [apps/web/src/pages/api/me/capabilities.ts](../../../apps/web/src/pages/api/me/capabilities.ts):
  - `GET` handler.
  - 401 if `locals.account` is null.
  - Reads cache → falls back to `resolveCapabilities()` → populates cache.
  - Returns `{ tier, hasSubscription, capabilities }` JSON with `Cache-Control: private, max-age=300` header.

## 4 — Verification

- [ ] 4.1 `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] 4.2 `pnpm --filter @baseout/web build` — clean.
- [ ] 4.3 `pnpm --filter @baseout/web test:unit` — green; new cache.test.ts included.
- [ ] 4.4 No `console.*` or `debugger` in the diff (CLAUDE.md §3.5).

## Out of scope

- Stripe webhook receiver / cache invalidation on tier change → `baseout-web-stripe-full`.
- Tier-comparison helpers (`enforceTierAtLeast`) — wait for a second real call site.
- React/island consumer of the endpoint — first real caller will land in the change that needs it.

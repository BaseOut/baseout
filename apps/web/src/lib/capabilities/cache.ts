/**
 * Per-isolate in-memory cache for resolved capability sets, keyed by
 * (organizationId, platformSlug). Bounds DB load on render hot-paths without
 * adding KV/D1 latency for what is effectively read-only data between Stripe
 * webhook updates.
 *
 * Invalidation is exposed for the future Stripe webhook receiver
 * (`baseout-web-stripe-full`) to call when a subscription tier flips. Until
 * that receiver lands, the 5-minute TTL bounds staleness — acceptable per
 * PRD §13.1 (subscription state is multi-day cadence in practice).
 */

import type { ResolvedCapabilities } from './resolve'

export const CAPABILITY_CACHE_TTL_MS = 5 * 60 * 1000

interface Entry {
  value: ResolvedCapabilities
  expiresAt: number
}

const CACHE = new Map<string, Entry>()

function key(organizationId: string, platformSlug: string): string {
  return `${organizationId}:${platformSlug}`
}

export function getCachedCapabilities(
  organizationId: string,
  platformSlug: string,
): ResolvedCapabilities | null {
  const hit = CACHE.get(key(organizationId, platformSlug))
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    CACHE.delete(key(organizationId, platformSlug))
    return null
  }
  return hit.value
}

export function setCachedCapabilities(
  organizationId: string,
  platformSlug: string,
  value: ResolvedCapabilities,
): void {
  CACHE.set(key(organizationId, platformSlug), {
    value,
    expiresAt: Date.now() + CAPABILITY_CACHE_TTL_MS,
  })
}

/**
 * Drops cache entries. With both args, evicts a single (org, platform) entry.
 * With only `organizationId`, evicts every entry for that org across all
 * platforms (used after a Stripe webhook reports a subscription change).
 */
export function invalidateCapabilityCache(
  organizationId: string,
  platformSlug?: string,
): void {
  if (platformSlug) {
    CACHE.delete(key(organizationId, platformSlug))
    return
  }
  const prefix = `${organizationId}:`
  for (const k of CACHE.keys()) {
    if (k.startsWith(prefix)) CACHE.delete(k)
  }
}

/** Test-only escape hatch — clears the entire cache. */
export function __resetCapabilityCacheForTests(): void {
  CACHE.clear()
}

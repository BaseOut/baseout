/**
 * App-shell chrome helpers — overlay inbox + nav prefetch.
 *
 * The overlay inbox is non-critical: a 3s engine timeout on every SidebarLayout
 * render made every click feel like a full reload. Layout SSR always starts with
 * an empty overlay (or explicit /inbox items) and InboxOverlay.astro loads the
 * feed after first paint via `server:defer`.
 *
 * Viewport prefetch of every sidebar link amplified that cost (one full SSR per
 * visible nav target). Hover prefetch starts the SSR only when a click is likely.
 *
 * Connection-health banner is the same class of chrome: SidebarLayout must not
 * await Hyperdrive for it. ConnectionHealthChrome.astro + a 15s isolate cache.
 */

import type { InboxItem } from '../components/layout/inbox'

export const INBOX_CACHE_TTL_MS = 15_000

const inboxCache = new Map<string, { items: InboxItem[]; expiresAt: number }>()

export function resolveLayoutInboxItems(
  explicit: InboxItem[] | undefined,
): InboxItem[] {
  return explicit ?? []
}

export function navPrefetchStrategy(
  href: string | undefined,
): 'hover' | undefined {
  return href?.startsWith('/') ? 'hover' : undefined
}

export function readInboxCache(
  key: string,
  now = Date.now(),
): InboxItem[] | null {
  const hit = inboxCache.get(key)
  if (!hit) return null
  if (hit.expiresAt <= now) {
    inboxCache.delete(key)
    return null
  }
  return hit.items
}

export function writeInboxCache(
  key: string,
  items: InboxItem[],
  now = Date.now(),
): void {
  inboxCache.set(key, { items, expiresAt: now + INBOX_CACHE_TTL_MS })
}

export function clearInboxCache(): void {
  inboxCache.clear()
}

export interface ConnectionHealthCacheEntry {
  connections: { status: string; displayName: string | null }[]
}

const healthCache = new Map<string, { value: ConnectionHealthCacheEntry; expiresAt: number }>()

export function readConnectionHealthCache(
  key: string,
  now = Date.now(),
): ConnectionHealthCacheEntry | null {
  const hit = healthCache.get(key)
  if (!hit) return null
  if (hit.expiresAt <= now) {
    healthCache.delete(key)
    return null
  }
  return hit.value
}

export function writeConnectionHealthCache(
  key: string,
  value: ConnectionHealthCacheEntry,
  now = Date.now(),
): void {
  healthCache.set(key, { value, expiresAt: now + INBOX_CACHE_TTL_MS })
}

export function clearConnectionHealthCache(): void {
  healthCache.clear()
}

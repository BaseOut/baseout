/**
 * SERVER-ONLY viewer-timezone plumbing for `lib/time.ts`.
 *
 * The formatters in `time.ts` render in the RUNTIME zone unless told otherwise
 * — and the SSR runtime is a Cloudflare Worker, i.e. UTC. This module resolves
 * the VIEWER'S zone per request and carries it through the render on an
 * AsyncLocalStorage (nodejs_compat is on), so no call site changes: importing
 * this module registers the resolver into `time.ts`.
 *
 * Resolution order:
 *   1. The `bo_tz` cookie — the viewer's real zone, set by a one-line script
 *      in `Layout.astro` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 *      Wrong only until the first page load completes.
 *   2. `request.cf.timezone` — Cloudflare's IP-derived zone, deployed envs
 *      only. Covers the very first request, before the cookie exists.
 *   3. Nothing — formatters fall back to the runtime zone (UTC), the previous
 *      behavior. Local dev's first-ever load lands here.
 *
 * Every candidate is validated by constructing an Intl.DateTimeFormat with it:
 * the cookie is client-writable input, and an invalid `timeZone` option would
 * otherwise make every formatter on the page THROW, not merely misprint.
 *
 * This file must never be imported from client code — it pulls in
 * `node:async_hooks`. The browser needs no resolver: its runtime zone is
 * already the viewer's.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { setServerTimeZoneResolver } from './time'

export const TZ_COOKIE = 'bo_tz'

/** IANA zone ids top out well under this; anything longer is not a zone. */
const MAX_TZ_LENGTH = 64

const tzStorage = new AsyncLocalStorage<string>()

setServerTimeZoneResolver(() => tzStorage.getStore())

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > MAX_TZ_LENGTH) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * The viewer's IANA zone for this request, or undefined when nothing valid
 * was offered (formatters then keep their runtime-zone fallback).
 */
export function resolveViewerTimeZone(
  cookieHeader: string | null | undefined,
  cfTimezone: string | undefined,
): string | undefined {
  const match = new RegExp(`(?:^|;\\s*)${TZ_COOKIE}=([^;]+)`).exec(cookieHeader ?? '')
  if (match) {
    let candidate: string
    try {
      candidate = decodeURIComponent(match[1])
    } catch {
      candidate = match[1]
    }
    if (isValidTimeZone(candidate)) return candidate
  }
  if (cfTimezone && isValidTimeZone(cfTimezone)) return cfTimezone
  return undefined
}

/**
 * Run `fn` (the rest of the middleware chain, i.e. the SSR render) with the
 * viewer's zone bound for `time.ts`. Un-scoped when no zone was resolved.
 */
export function runWithTimeZone<T>(tz: string | undefined, fn: () => T): T {
  return tz ? tzStorage.run(tz, fn) : fn()
}

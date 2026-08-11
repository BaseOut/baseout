/**
 * Inbox feed fan-out (web-notifications-inbox §5.1 / server-notifications-inbox).
 *
 * The Inbox is ACCOUNT-level but the engine feed is per-Space, so the shell
 * fans out across the account's Spaces in parallel at SSR time, labels each
 * row with its Space name (only when the account has 2+ Spaces — with one,
 * the label is noise the panel never renders), and merges newest-first.
 *
 * HARD RULE: the feed can never block or break a page render. Every failure
 * mode — engine error, transport throw, timeout, unknown item kind from a
 * newer engine — degrades to an empty contribution and the panel's designed
 * zero-states.
 */

import { KIND_META, type InboxItem, type InboxKind } from '../components/layout/inbox'
import type { BackupEngineClient, InboxItemView } from './backup-engine'

export interface InboxFeedSpace {
  id: string
  name: string
}

export interface SpaceFeed {
  space: InboxFeedSpace
  items: InboxItemView[]
}

/** A slow engine must not hold every page render hostage. */
const DEFAULT_TIMEOUT_MS = 3000

/**
 * Pure merge + label. One entry per Space (empty on failure), so the 2+-Spaces
 * labelling rule follows the ACCOUNT's Space count, not how many feeds happened
 * to return rows. Rows always get `spaceId` (the triage-route address); they
 * get the display `space` label only on multi-Space accounts. Unknown kinds
 * are dropped — `KIND_META[kind]` lookups would throw mid-render otherwise.
 */
export function mergeSpaceFeeds(feeds: SpaceFeed[]): InboxItem[] {
  const label = feeds.length > 1
  const out: InboxItem[] = []
  for (const { space, items } of feeds) {
    for (const item of items) {
      if (!(item.kind in KIND_META)) continue
      const row: InboxItem = { ...item, kind: item.kind as InboxKind, spaceId: space.id }
      if (label) row.space = space.name
      out.push(row)
    }
  }
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at))
}

/** Resolve to null (never reject) once `ms` elapses. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      () => {
        clearTimeout(t)
        resolve(null)
      },
    )
  })
}

/**
 * Fan out `getNotifications` across the account's Spaces IN PARALLEL and merge.
 * Per-Space failures and timeouts contribute [] — they never throw, never wait
 * past the timeout, never take the other Spaces' rows down with them.
 */
export async function fetchInboxItems(
  engine: BackupEngineClient,
  spaces: InboxFeedSpace[],
  opts: { timeoutMs?: number } = {},
): Promise<InboxItem[]> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const feeds = await Promise.all(
    spaces.map(async (space): Promise<SpaceFeed> => {
      try {
        const res = await withTimeout(engine.getNotifications(space.id), timeoutMs)
        return { space, items: res?.ok ? res.items : [] }
      } catch {
        return { space, items: [] }
      }
    }),
  )
  return mergeSpaceFeeds(feeds)
}

/**
 * Map an engine error to the HTTP status the inbox proxy routes return.
 * 4xx passes through (the engine's 422 "done on a state-backed id" rejection
 * must reach the client as a client error); transport failures are a 502.
 */
export function inboxProxyStatus(err: { code: string; status: number }): number {
  if (err.code === 'engine_unreachable') return 502
  if (err.status >= 400 && err.status <= 599) return err.status
  return 500
}

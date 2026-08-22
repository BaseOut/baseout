/**
 * 15s in-isolate snapshot of the Data page engine payload.
 * Memory only — do not await Cache API on this path.
 */
import type { DataPageEnginePayload } from './ssr'
import { emptyDataPagePayload } from './ssr'

export const DATA_PAGE_SNAPSHOT_TTL_MS = 15_000

type Entry = { payload: DataPageEnginePayload; expiresAt: number }

const L1 = new Map<string, Entry>()

export function rememberDataPageSnapshot(spaceId: string, payload: DataPageEnginePayload): void {
  L1.set(spaceId, {
    payload,
    expiresAt: Date.now() + DATA_PAGE_SNAPSHOT_TTL_MS,
  })
}

export function peekDataPageSnapshot(spaceId: string): DataPageEnginePayload | undefined {
  const hit = L1.get(spaceId)
  if (!hit || hit.expiresAt <= Date.now()) return undefined
  return hit.payload
}

export function clearDataPageSnapshots(): void {
  L1.clear()
}

export function emptySnapshot(): DataPageEnginePayload {
  return emptyDataPagePayload()
}

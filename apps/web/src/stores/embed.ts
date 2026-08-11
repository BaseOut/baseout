// Embedded-mode state (shared-embed-protocol, spec web-embedded-mode).
// Embed mode is entered via /embed and survives full-page navigation through
// sessionStorage — each page load rehydrates the store and (in embed mode)
// re-boots the child bridge, which re-handshakes with the host (the protocol's
// ready-beacon/hello-retry design makes the re-handshake free).
import { atom } from 'nanostores'
import type { EmbedContext, HostKind } from '@baseout/embed-protocol'

export interface EmbedState {
  active: boolean
  host: HostKind | null
  context: EmbedContext | null
  /** Backup-config bases snapshot captured at /embed load, for route resolution. */
  bases: { atBaseId: string; isIncluded: boolean }[]
}

const STORAGE_KEY = 'bo-embed'
const INACTIVE: EmbedState = { active: false, host: null, context: null, bases: [] }

export const $embed = atom<EmbedState>(INACTIVE)

export function hydrateEmbedFromSession(): EmbedState {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as EmbedState
      if (parsed && parsed.active) {
        $embed.set(parsed)
        return parsed
      }
    }
  } catch {
    // corrupted/blocked storage — stay standalone
  }
  return INACTIVE
}

export function setEmbedState(state: EmbedState): void {
  $embed.set(state)
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (rare in-iframe) — store still works for this page
  }
}

/** Wired into logout alongside the other user-scoped stores. */
export function resetEmbed(): void {
  $embed.set(INACTIVE)
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

import { atom } from 'nanostores'

export interface SpaceSummary {
  id: string
  name: string
  status: string
}

export interface SpacesState {
  list: SpaceSummary[]
  activeSpaceId: string | null
}

export const $spaces = atom<SpacesState | null>(null)

/**
 * Hydrates `$spaces` from the SSR-rendered `<script id="spaces-state">` JSON tag
 * emitted by `SidebarLayout.astro`. Mirrors the `#account-state` /
 * `#integrations-state` patterns; canonical per CLAUDE.md §4.
 *
 * Safe to call multiple times — Astro view transitions re-mount the layout, so
 * the script tag is replaced in place; re-reading just refreshes the atom.
 */
export function hydrateSpacesFromDom(): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById('spaces-state')
  if (!el?.textContent) return
  try {
    $spaces.set(JSON.parse(el.textContent) as SpacesState)
  } catch {
    // Malformed JSON shouldn't crash the client — leave the atom alone.
  }
}

export async function refreshSpaces(): Promise<void> {
  const res = await fetch('/api/spaces', {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) return
  const body = (await res.json()) as { spaces: SpaceSummary[]; activeSpaceId: string | null }
  $spaces.set({ list: body.spaces, activeSpaceId: body.activeSpaceId })
}

if (typeof document !== 'undefined') {
  hydrateSpacesFromDom()
  document.addEventListener('astro:after-swap', hydrateSpacesFromDom)
}

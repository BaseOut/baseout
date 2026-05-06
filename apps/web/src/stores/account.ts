import { atom } from 'nanostores'
import type { AccountContext } from '../lib/account'

export const $account = atom<AccountContext | null>(null)

/**
 * Hydrates `$account` from the SSR-rendered `<script id="account-state">` JSON
 * tag emitted by pages that load the account context (e.g., `index.astro`).
 * Mirrors `hydrateSpacesFromDom()` in `./spaces.ts`. Canonical per CLAUDE.md §4.
 *
 * Pages may continue to inline the parse for clarity at the call site; this
 * helper exists for testability and for new pages that prefer a one-liner.
 */
export function hydrateAccountFromDom(): AccountContext | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById('account-state')
  if (!el?.textContent) return null
  try {
    const parsed = JSON.parse(el.textContent) as AccountContext | null
    $account.set(parsed)
    return parsed
  } catch {
    return null
  }
}

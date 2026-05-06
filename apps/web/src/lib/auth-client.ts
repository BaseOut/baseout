/**
 * Better Auth — Browser Client
 *
 * Used in client-side scripts for magic-link sign-in and sign-out.
 * Passwordless only — no email+password, no OAuth in V1.
 */

import { createAuthClient } from 'better-auth/client'
import { magicLinkClient } from 'better-auth/client/plugins'
import { $account } from '../stores/account'
import { $spaces } from '../stores/spaces'
import { $integrations } from '../stores/connections'
import { setButtonLoading } from './ui'

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})

/**
 * Terminates the session and resets every user-scoped nanostore.
 *
 * Per CLAUDE.md §4 ("Reset stores on logout. The logout handler must clear
 * every user-scoped store"). The redirect happens after store reset so any
 * subscriber that fires on the null-set sees an unauthenticated client state
 * rather than a half-cleared one.
 *
 * Pass the originating button to get a loading spinner via `setButtonLoading`
 * for the duration of the round-trip.
 */
export async function signOutAndRedirect(
  btn?: HTMLButtonElement,
): Promise<void> {
  if (btn) setButtonLoading(btn, true)
  try {
    await authClient.signOut()
  } finally {
    $account.set(null)
    $integrations.set(null)
    $spaces.set(null)
    window.location.href = '/login'
  }
}

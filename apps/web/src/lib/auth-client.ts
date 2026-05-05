/**
 * Better Auth — Browser Client
 *
 * Used in client-side scripts for magic-link sign-in and sign-out.
 * Passwordless only — no email+password, no OAuth in V1.
 */

import { createAuthClient } from 'better-auth/client'
import { magicLinkClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})

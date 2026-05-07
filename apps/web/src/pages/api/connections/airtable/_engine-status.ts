// Pure mapping from EngineWhoamiError["code"] (the engine client's typed
// error union) to the HTTP status this route returns to the browser.
// Underscore-prefixed: Astro file-based routing skips it. Lives here (not in
// src/lib/) because it's only the Airtable-test route's mapping; if a second
// route ever needs the same translation, lift it then.
//
// 4xx = user can act (reconnect / fix input).
// 5xx = operator or upstream problem (no user action helps).

import type { EngineWhoamiError } from '../../../../lib/backup-engine'

export type EngineErrorCode = EngineWhoamiError['code']

export function mapEngineCodeToStatus(code: EngineErrorCode): number {
  switch (code) {
    case 'invalid_connection_id':
      return 400
    case 'connection_not_found':
      return 404
    // Row exists but status !== 'active' — user must reconnect.
    case 'connection_status':
      return 409
    // Airtable revoked the token — user must reconnect.
    case 'airtable_token_rejected':
      return 409
    // Airtable upstream failure (5xx) — transient, retry.
    case 'airtable_upstream':
      return 502
    // Web↔engine token mismatch — operator misconfig, never user's fault.
    case 'unauthorized':
      return 502
    // Engine couldn't decrypt the stored ciphertext — encryption-key mismatch
    // between writer (apps/web at OAuth time) and reader (apps/server now).
    case 'decrypt_failed':
      return 500
    // Engine missing INTERNAL_TOKEN or BASEOUT_ENCRYPTION_KEY.
    case 'server_misconfigured':
      return 503
    // apps/server isn't reachable — start `pnpm --filter @baseout/server dev`.
    case 'engine_unreachable':
      return 503
    // Engine returned an HTTP status with an error code we don't know yet.
    case 'engine_error':
      return 502
  }
}

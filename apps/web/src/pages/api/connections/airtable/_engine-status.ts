// Pure mapping from engine error codes (from BackupEngineClient's typed error
// unions) to the HTTP status this route returns to the browser.
// Underscore-prefixed: Astro file-based routing skips it. Lives here (not in
// src/lib/) because it's the airtable-test route's mapping today; the
// Phase 9 backup-runs route also imports it. If a third route ever needs
// the same translation, lift this to src/lib/.
//
// 4xx = user can act (reconnect / fix input).
// 5xx = operator or upstream problem (no user action helps).

import type {
  EngineWhoamiError,
  EngineStartRunError,
  EngineCancelRunError,
} from '../../../../lib/backup-engine'

export type EngineErrorCode =
  | EngineWhoamiError['code']
  | EngineStartRunError['code']
  | EngineCancelRunError['code']

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
    // Phase 9 — startRun: defensive (queued row deleted between INSERT and
    // engine fan-out).
    case 'run_not_found':
      return 404
    // Phase 9 — startRun: row exists but already running/succeeded; UI polls.
    case 'run_already_started':
      return 409
    // Phase 9 — startRun: connection.status !== 'active'; show reconnect prompt.
    case 'invalid_connection':
      return 409
    // Phase 9 — startRun: user hasn't completed the storage/frequency wizard.
    case 'config_not_found':
      return 404
    // Phase 9 — startRun: defense-in-depth; StoragePicker should already block.
    case 'unsupported_storage_type':
      return 422
    // Phase 9 — startRun: wizard step 2 wasn't completed.
    case 'no_bases_selected':
      return 422
    // Phase 8.cancel — cancelRun: run is already terminal (or another
    // cancel won the CAS). UI polls — chip will reflect the actual
    // terminal state on the next tick.
    case 'run_already_terminal':
      return 409
  }
}

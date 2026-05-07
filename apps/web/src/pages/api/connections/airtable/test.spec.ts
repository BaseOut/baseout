// Unit tests for mapEngineCodeToStatus — the pure helper that turns each
// EngineWhoamiError["code"] into an HTTP status the browser can act on.
// The full request/response shape is exercised end-to-end through Playwright;
// this file just locks down the per-code mapping so future code additions
// don't silently fall back to a bare 502.

import { describe, expect, it } from 'vitest'
import { mapEngineCodeToStatus } from './_engine-status'

describe('mapEngineCodeToStatus', () => {
  it.each([
    // 4xx — user can act
    ['invalid_connection_id', 400],
    ['connection_not_found', 404],
    ['connection_status', 409],
    ['airtable_token_rejected', 409],
    // 5xx — operator / upstream
    ['airtable_upstream', 502],
    ['unauthorized', 502],
    ['decrypt_failed', 500],
    ['server_misconfigured', 503],
    ['engine_unreachable', 503],
    ['engine_error', 502],
  ] as const)('maps %s → %i', (code, expected) => {
    expect(mapEngineCodeToStatus(code)).toBe(expected)
  })
})

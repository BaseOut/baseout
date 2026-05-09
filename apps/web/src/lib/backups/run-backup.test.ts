import { describe, expect, it, vi } from 'vitest'
import {
  runBackup,
  describeRunBackupError,
  type RunBackupError,
} from './run-backup'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('runBackup', () => {
  it('POSTs the canonical URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ runId: 'r_1', triggerRunIds: [] }),
    )
    await runBackup(SPACE_ID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`/api/spaces/${SPACE_ID}/backup-runs`)
    expect(init?.method).toBe('POST')
  })

  it('returns runId + triggerRunIds on 200', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ runId: 'r_42', triggerRunIds: ['run_a', 'run_b'] }),
    )
    const result = await runBackup(SPACE_ID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({
      ok: true,
      runId: 'r_42',
      triggerRunIds: ['run_a', 'run_b'],
    })
  })

  it.each([
    ['no_bases_selected', 422],
    ['no_active_connection', 422],
    ['invalid_connection', 409],
    ['config_not_found', 404],
    ['run_already_started', 409],
    ['unsupported_storage_type', 422],
    ['space_not_found', 403],
    ['space_org_mismatch', 403],
    ['engine_unreachable', 503],
  ] as const)('maps %s on %i', async (error, status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error }, status))
    const result = await runBackup(SPACE_ID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error, status })
  })

  it('maps 401 to unauthenticated', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: 'Not authenticated' }, 401),
    )
    const result = await runBackup(SPACE_ID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({
      ok: false,
      error: 'unauthenticated',
      status: 401,
    })
  })

  it('maps fetch failure to network error', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await runBackup(SPACE_ID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error: 'network', status: 0 })
  })

  it('maps unknown error codes to unknown', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: 'something_else' }, 418),
    )
    const result = await runBackup(SPACE_ID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error: 'unknown', status: 418 })
  })
})

describe('describeRunBackupError', () => {
  it.each([
    'no_bases_selected',
    'no_active_connection',
    'invalid_connection',
    'config_not_found',
    'run_already_started',
    'unsupported_storage_type',
    'space_not_found',
    'space_org_mismatch',
    'unauthenticated',
    'engine_unreachable',
    'network',
    'unknown',
  ] as RunBackupError[])('returns a non-empty message for %s', (code) => {
    expect(describeRunBackupError(code).length).toBeGreaterThan(0)
  })
})

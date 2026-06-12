import { describe, expect, it, vi } from 'vitest'
import { describeSaveSelectionError, saveBaseSelection } from './save-selection'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('saveBaseSelection', () => {
  it('POSTs the canonical URL with atBaseIds', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }))
    await saveBaseSelection(SPACE_ID, ['b1', 'b2'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`/api/spaces/${SPACE_ID}/backup-config/bases`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ atBaseIds: ['b1', 'b2'] })
  })

  it('returns ok on 200', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }))
    const result = await saveBaseSelection(SPACE_ID, [], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: true })
  })

  it.each([
    ['over_tier_limit', 422],
    ['unknown_base_ids', 422],
    ['space_not_found', 403],
    ['space_org_mismatch', 403],
  ] as const)('maps %s on %i', async (error, status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error }, status))
    const result = await saveBaseSelection(SPACE_ID, ['b1'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error, status })
  })

  it('maps 401 to unauthenticated regardless of body shape', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: 'Not authenticated' }, 401),
    )
    const result = await saveBaseSelection(SPACE_ID, ['b1'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error: 'unauthenticated', status: 401 })
  })

  it('maps fetch failure to network error with status 0', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await saveBaseSelection(SPACE_ID, ['b1'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error: 'network', status: 0 })
  })

  it('maps unknown error codes to "unknown"', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: 'something_else' }, 418),
    )
    const result = await saveBaseSelection(SPACE_ID, ['b1'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, error: 'unknown', status: 418 })
  })

  it('has copy for every error code', () => {
    const codes = [
      'over_tier_limit',
      'unknown_base_ids',
      'invalid_request',
      'space_not_found',
      'space_org_mismatch',
      'unauthenticated',
      'network',
      'unknown',
    ] as const
    for (const code of codes) {
      expect(describeSaveSelectionError(code)).toBeTruthy()
    }
  })
})

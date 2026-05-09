import { describe, expect, it, vi } from 'vitest'
import { saveBackupConfig } from './save-config'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('saveBackupConfig', () => {
  it('PATCHes the canonical URL with the body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }))
    await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'monthly', storageType: 'r2_managed' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`/api/spaces/${SPACE_ID}/backup-config`)
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      frequency: 'monthly',
      storageType: 'r2_managed',
    })
  })

  it('returns ok on 200', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }))
    const result = await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'weekly' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(result).toEqual({ ok: true })
  })

  it('omits unset body fields', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }))
    await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'weekly' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    const init = fetchImpl.mock.calls[0]![1]
    expect(JSON.parse(init?.body as string)).toEqual({ frequency: 'weekly' })
  })

  it.each([
    ['frequency_not_allowed', 422],
    ['unsupported_storage_type', 422],
    ['invalid_request', 400],
    ['space_not_found', 403],
    ['space_org_mismatch', 403],
  ] as const)('maps %s on %i', async (error, status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error }, status))
    const result = await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'daily' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(result).toEqual({ ok: false, error, status })
  })

  it('maps 401 to unauthenticated regardless of body shape', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: 'Not authenticated' }, 401),
    )
    const result = await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'weekly' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(result).toEqual({
      ok: false,
      error: 'unauthenticated',
      status: 401,
    })
  })

  it('maps fetch failure to network error with status 0', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'weekly' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(result).toEqual({ ok: false, error: 'network', status: 0 })
  })

  it('maps unknown error codes to "unknown"', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: 'something_we_dont_handle' }, 418),
    )
    const result = await saveBackupConfig(
      { spaceId: SPACE_ID, frequency: 'weekly' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(result).toEqual({ ok: false, error: 'unknown', status: 418 })
  })
})

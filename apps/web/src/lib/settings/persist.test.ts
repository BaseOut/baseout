import { afterEach, describe, expect, it, vi } from 'vitest'

const updateUser = vi.fn()
vi.mock('../auth-client', () => ({
  authClient: { updateUser: (...args: unknown[]) => updateUser(...args) },
}))

const { persistAccountName, persistSpaceAutoAdd, persistSpaceName } = await import('./persist')

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('persistAccountName', () => {
  it('uses better-auth updateUser', async () => {
    updateUser.mockResolvedValue({ error: null })
    await expect(persistAccountName('Ada')).resolves.toEqual({ ok: true })
    expect(updateUser).toHaveBeenCalledWith({ name: 'Ada' })
  })

  it('surfaces a server error instead of flashing Saved', async () => {
    updateUser.mockResolvedValue({ error: { message: 'nope' } })
    await expect(persistAccountName('Ada')).resolves.toEqual({
      ok: false,
      error: 'Could not save your name. Try again.',
    })
  })
})

describe('persistSpaceName', () => {
  it('PATCHes the Space rename route', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, name: 'Ops' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(persistSpaceName('space-1', 'Ops')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/spaces/space-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Ops' }),
      }),
    )
  })
})

describe('persistSpaceAutoAdd', () => {
  it('PATCHes backup-config autoAddFutureBases', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(persistSpaceAutoAdd('space-1', true)).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/spaces/space-1/backup-config',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ autoAddFutureBases: true }),
      }),
    )
  })
})

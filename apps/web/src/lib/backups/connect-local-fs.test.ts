import { describe, expect, it, vi } from 'vitest'
import { connectLocalFs } from './connect-local-fs'

function jsonResponse(status: number): Response {
  return new Response(status === 200 ? JSON.stringify({ ok: true }) : '{}', {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('connectLocalFs', () => {
  it('POSTs the local-fs connect route and returns ok on 200', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200))
    const res = await connectLocalFs({ fetchImpl })
    expect(res).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/connections/storage/local-fs/connect',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('maps 401 → unauthenticated', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401))
    expect(await connectLocalFs({ fetchImpl })).toEqual({
      ok: false,
      error: 'unauthenticated',
      status: 401,
    })
  })

  it('maps 403 → no_active_space', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403))
    expect(await connectLocalFs({ fetchImpl })).toEqual({
      ok: false,
      error: 'no_active_space',
      status: 403,
    })
  })

  it('maps a thrown fetch → network', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await connectLocalFs({ fetchImpl })).toEqual({
      ok: false,
      error: 'network',
      status: 0,
    })
  })

  it('maps an unexpected status → unknown', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500))
    expect(await connectLocalFs({ fetchImpl })).toEqual({
      ok: false,
      error: 'unknown',
      status: 500,
    })
  })
})

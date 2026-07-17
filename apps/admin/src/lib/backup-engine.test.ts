import { describe, expect, it, vi } from 'vitest'
import { createAdminEngine } from './backup-engine'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function makeBinding(fetchImpl: FetchLike) {
  return { fetch: vi.fn(fetchImpl) }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createAdminEngine', () => {
  it('returns null when the binding is missing', () => {
    expect(createAdminEngine({ binding: undefined, internalToken: 'tok' })).toBeNull()
  })

  it('returns null when the token is missing', () => {
    const binding = makeBinding(async () => jsonResponse(200, {}))
    expect(createAdminEngine({ binding, internalToken: undefined })).toBeNull()
  })
})

describe('startRun', () => {
  it('POSTs the internal start route with the token and returns the body on 2xx', async () => {
    const binding = makeBinding(async () =>
      jsonResponse(202, { runId: 'run-1', triggerRunIds: ['tr_1', 'tr_2'] }),
    )
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    const result = await engine.startRun('run-1')

    expect(result).toEqual({ ok: true, runId: 'run-1', triggerRunIds: ['tr_1', 'tr_2'] })
    const [url, init] = binding.fetch.mock.calls[0]
    expect(url).toBe('https://engine/api/internal/runs/run-1/start')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['x-internal-token']).toBe('tok')
  })

  it('maps a known engine error code on non-2xx', async () => {
    const binding = makeBinding(async () => jsonResponse(409, { error: 'no_bases_selected' }))
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    expect(await engine.startRun('run-1')).toEqual({
      ok: false,
      code: 'no_bases_selected',
      status: 409,
    })
  })

  it('falls back to engine_error on an unknown non-2xx body', async () => {
    const binding = makeBinding(async () => new Response('nope', { status: 500 }))
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    expect(await engine.startRun('run-1')).toEqual({ ok: false, code: 'engine_error', status: 500 })
  })

  it('returns engine_unreachable when fetch throws', async () => {
    const binding = makeBinding(async () => { throw new Error('network') })
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    expect(await engine.startRun('run-1')).toEqual({
      ok: false,
      code: 'engine_unreachable',
      status: 0,
    })
  })
})

describe('cancelRun', () => {
  it('POSTs the internal cancel route and returns cancelled trigger ids', async () => {
    const binding = makeBinding(async () =>
      jsonResponse(200, { cancelledTriggerRunIds: ['tr_1'] }),
    )
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    const result = await engine.cancelRun('run-9')

    expect(result).toEqual({ ok: true, cancelledTriggerRunIds: ['tr_1'] })
    expect(binding.fetch.mock.calls[0][0]).toBe('https://engine/api/internal/runs/run-9/cancel')
  })

  it('maps run_already_terminal on non-2xx', async () => {
    const binding = makeBinding(async () => jsonResponse(409, { error: 'run_already_terminal' }))
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    expect(await engine.cancelRun('run-9')).toEqual({
      ok: false,
      code: 'run_already_terminal',
      status: 409,
    })
  })
})

describe('tokenHealth', () => {
  it('GETs the token-health route and returns the counters on 2xx', async () => {
    const binding = makeBinding(async () =>
      jsonResponse(200, { activeExpired: 2, refreshExpiringSoon: 1 }),
    )
    const engine = createAdminEngine({ binding, internalToken: 'tok' })!

    const result = await engine.tokenHealth()

    expect(result).toEqual({ ok: true, activeExpired: 2, refreshExpiringSoon: 1 })
    const [url, init] = binding.fetch.mock.calls[0]
    expect(url).toBe('https://engine/api/internal/connections/token-health')
    expect(init?.method).toBe('GET')
    expect((init?.headers as Record<string, string>)['x-internal-token']).toBe('tok')
  })

  it('maps unauthorized and collapses other failures to engine_error', async () => {
    const unauthorized = createAdminEngine({
      binding: makeBinding(async () => jsonResponse(401, { error: 'unauthorized' })),
      internalToken: 'tok',
    })!
    expect(await unauthorized.tokenHealth()).toEqual({ ok: false, code: 'unauthorized', status: 401 })

    const broken = createAdminEngine({
      binding: makeBinding(async () => new Response('boom', { status: 500 })),
      internalToken: 'tok',
    })!
    expect(await broken.tokenHealth()).toEqual({ ok: false, code: 'engine_error', status: 500 })
  })

  it('returns engine_unreachable when the binding throws', async () => {
    const engine = createAdminEngine({
      binding: makeBinding(async () => {
        throw new Error('network')
      }),
      internalToken: 'tok',
    })!
    expect(await engine.tokenHealth()).toEqual({ ok: false, code: 'engine_unreachable', status: 0 })
  })
})

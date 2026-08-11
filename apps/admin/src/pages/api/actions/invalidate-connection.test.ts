import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./invalidate-connection')
type HandleInput = Parameters<typeof handlePost>[0]
type HandleDeps = Parameters<typeof handlePost>[1]

const CONN_ID = '7a1b2c30-4444-4555-8666-abcdefabcdef'
const SELF = 'http://baseout.local:4332'

function makeInput(overrides: Partial<HandleInput> = {}): HandleInput {
  return {
    origin: SELF,
    selfOrigin: SELF,
    body: { connectionId: CONN_ID },
    actor: { id: 'user-1', email: 'staff@openside.com' },
    ...overrides,
  }
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    fetchConnectionById: vi.fn(async () => ({
      id: CONN_ID,
      organizationId: 'org-1',
      status: 'active',
    })),
    markConnectionInvalid: vi.fn(async () => {}),
    fetchActiveRunIdsForConnection: vi.fn(async () => ['run-1']),
    engineCancelRun: vi.fn(async () => ({ ok: true as const, cancelledTriggerRunIds: [] })),
    audit: {
      insertAuditRow: vi.fn(async () => 'row-id'),
      countRecentIntentsByActor: vi.fn(async () => 0),
    },
    ...overrides,
  }
}

describe('POST /api/actions/invalidate-connection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates, cancels in-flight runs, and audits with previousStatus', async () => {
    const deps = makeDeps()

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      cancelledRuns: [{ runId: 'run-1', ok: true }],
    })
    expect(deps.markConnectionInvalid).toHaveBeenCalledWith(CONN_ID)
    const intentRow = vi.mocked(deps.audit.insertAuditRow).mock.calls[0][0]
    expect(intentRow).toMatchObject({
      phase: 'intent',
      action: 'invalidate_connection',
      targetType: 'connection',
      targetId: CONN_ID,
      organizationId: 'org-1',
      params: { previousStatus: 'active' },
    })
  })

  it('degrades to skipped_no_engine when the engine client is absent', async () => {
    const deps = makeDeps({ engineCancelRun: null })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, cancelledRuns: 'skipped_no_engine' })
    expect(deps.markConnectionInvalid).toHaveBeenCalled()
  })

  it('rejects a cross-origin request', async () => {
    const res = await handlePost(makeInput({ origin: null }), makeDeps())
    expect(res.status).toBe(403)
  })

  it('rejects a malformed connection id', async () => {
    const res = await handlePost(makeInput({ body: { connectionId: 42 } }), makeDeps())
    expect(res.status).toBe(400)
  })

  it('404s when the connection does not exist, without auditing', async () => {
    const deps = makeDeps({ fetchConnectionById: vi.fn(async () => null) })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'connection_not_found' })
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
  })

  it('409s when the connection is already invalid, without auditing', async () => {
    const deps = makeDeps({
      fetchConnectionById: vi.fn(async () => ({
        id: CONN_ID,
        organizationId: 'org-1',
        status: 'invalid',
      })),
    })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'already_invalid' })
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
  })

  it('429s when rate-limited', async () => {
    const deps = makeDeps({
      audit: {
        insertAuditRow: vi.fn(async () => 'row-id'),
        countRecentIntentsByActor: vi.fn(async () => 99),
      },
    })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(429)
    expect(deps.markConnectionInvalid).not.toHaveBeenCalled()
  })
})

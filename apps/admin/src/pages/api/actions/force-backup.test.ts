import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./force-backup')
type HandleInput = Parameters<typeof handlePost>[0]
type HandleDeps = Parameters<typeof handlePost>[1]

const SPACE_ID = '9c8d7e60-2222-4333-8444-abcdefabcdef'
const SELF = 'http://baseout.local:4332'

function makeInput(overrides: Partial<HandleInput> = {}): HandleInput {
  return {
    origin: SELF,
    selfOrigin: SELF,
    body: { spaceId: SPACE_ID },
    actor: { id: 'user-1', email: 'staff@openside.com' },
    ...overrides,
  }
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    fetchSpaceById: vi.fn(async () => ({ id: SPACE_ID, organizationId: 'org-1' })),
    backup: {
      fetchAirtableConnection: vi.fn(async () => ({ id: 'conn-1', status: 'active' })),
      countIncludedBases: vi.fn(async () => 3),
      insertBackupRun: vi.fn(async () => 'run-1'),
      deleteBackupRun: vi.fn(async () => {}),
      engineStartRun: vi.fn(async () => ({
        ok: true as const,
        runId: 'run-1',
        triggerRunIds: ['tr_1'],
      })),
    },
    engineConfigured: true,
    audit: {
      insertAuditRow: vi.fn(async () => 'row-id'),
      countRecentIntentsByActor: vi.fn(async () => 0),
    },
    ...overrides,
  }
}

describe('POST /api/actions/force-backup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queues a run and audits with the runId in the result row', async () => {
    const deps = makeDeps()

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, runId: 'run-1', triggerRunIds: ['tr_1'] })
    const calls = vi.mocked(deps.audit.insertAuditRow).mock.calls
    expect(calls[0][0]).toMatchObject({
      phase: 'intent',
      action: 'force_backup',
      targetType: 'space',
      targetId: SPACE_ID,
      organizationId: 'org-1',
    })
    expect(calls[1][0]).toMatchObject({
      phase: 'result',
      params: { ok: true, runId: 'run-1' },
    })
  })

  it('503s when the engine binding/token is not configured, before auditing', async () => {
    const deps = makeDeps({ engineConfigured: false })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'server_misconfigured' })
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
    expect(deps.backup.insertBackupRun).not.toHaveBeenCalled()
  })

  it('rejects a cross-origin request', async () => {
    const res = await handlePost(makeInput({ origin: 'https://evil.example' }), makeDeps())
    expect(res.status).toBe(403)
  })

  it('rejects a malformed space id', async () => {
    const res = await handlePost(makeInput({ body: {} }), makeDeps())
    expect(res.status).toBe(400)
  })

  it('404s when the space does not exist, without auditing', async () => {
    const deps = makeDeps({ fetchSpaceById: vi.fn(async () => null) })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'space_not_found' })
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
  })

  it('409s domain rejections (no bases selected) and records them in the result row', async () => {
    const deps = makeDeps()
    deps.backup.countIncludedBases = vi.fn(async () => 0)

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'no_bases_selected' })
    const resultRow = vi.mocked(deps.audit.insertAuditRow).mock.calls[1][0]
    expect(resultRow.params).toMatchObject({ ok: false, code: 'no_bases_selected' })
  })

  it('502s engine-side failures with the engine code', async () => {
    const deps = makeDeps()
    deps.backup.engineStartRun = vi.fn(async () => ({
      ok: false as const,
      code: 'engine_unreachable' as const,
      status: 0,
    }))

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'engine_unreachable' })
  })

  it('429s when rate-limited, touching nothing', async () => {
    const deps = makeDeps({
      audit: {
        insertAuditRow: vi.fn(async () => 'row-id'),
        countRecentIntentsByActor: vi.fn(async () => 10),
      },
    })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(429)
    expect(deps.backup.insertBackupRun).not.toHaveBeenCalled()
  })
})

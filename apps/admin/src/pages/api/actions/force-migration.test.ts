import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./force-migration')
type HandleInput = Parameters<typeof handlePost>[0]
type HandleDeps = Parameters<typeof handlePost>[1]

const ORG_ID = '3f9b2f60-1111-4222-8333-abcdefabcdef'
const SELF = 'http://baseout.local:4332'

function makeInput(overrides: Partial<HandleInput> = {}): HandleInput {
  return {
    origin: SELF,
    selfOrigin: SELF,
    body: { organizationId: ORG_ID },
    actor: { id: 'user-1', email: 'staff@openside.com' },
    ...overrides,
  }
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    fetchOrgById: vi.fn(async () => ({ id: ORG_ID, slug: 'acme', hasMigrated: false })),
    markMigrated: vi.fn(async () => {}),
    audit: {
      insertAuditRow: vi.fn(async () => 'row-id'),
      countRecentIntentsByActor: vi.fn(async () => 0),
    },
    ...overrides,
  }
}

describe('POST /api/actions/force-migration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the org migrated and audits intent + result', async () => {
    const deps = makeDeps()

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(deps.markMigrated).toHaveBeenCalledWith(ORG_ID)
    expect(deps.audit.insertAuditRow).toHaveBeenCalledTimes(2)
    expect(vi.mocked(deps.audit.insertAuditRow).mock.calls[0][0]).toMatchObject({
      phase: 'intent',
      action: 'force_migration',
      targetType: 'organization',
      targetId: ORG_ID,
      organizationId: ORG_ID,
      params: { orgSlug: 'acme' },
    })
  })

  it('rejects a cross-origin request before doing anything', async () => {
    const deps = makeDeps()

    const res = await handlePost(makeInput({ origin: 'https://evil.example' }), deps)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'bad_origin' })
    expect(deps.fetchOrgById).not.toHaveBeenCalled()
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
  })

  it('rejects a malformed body', async () => {
    const res = await handlePost(makeInput({ body: { organizationId: 'not-a-uuid' } }), makeDeps())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('404s when the org does not exist, without auditing', async () => {
    const deps = makeDeps({ fetchOrgById: vi.fn(async () => null) })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'org_not_found' })
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
  })

  it('409s when the org is already migrated, without auditing', async () => {
    const deps = makeDeps({
      fetchOrgById: vi.fn(async () => ({ id: ORG_ID, slug: 'acme', hasMigrated: true })),
    })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'already_migrated' })
    expect(deps.audit.insertAuditRow).not.toHaveBeenCalled()
  })

  it('429s when the actor is rate-limited', async () => {
    const deps = makeDeps({
      audit: {
        insertAuditRow: vi.fn(async () => 'row-id'),
        countRecentIntentsByActor: vi.fn(async () => 10),
      },
    })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    expect(deps.markMigrated).not.toHaveBeenCalled()
  })

  it('500s when the audit intent write fails, without executing', async () => {
    const deps = makeDeps({
      audit: {
        insertAuditRow: vi.fn(async () => { throw new Error('db down') }),
        countRecentIntentsByActor: vi.fn(async () => 0),
      },
    })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'audit_write_failed' })
    expect(deps.markMigrated).not.toHaveBeenCalled()
  })

  it('500s when the update throws mid-action', async () => {
    const deps = makeDeps({ markMigrated: vi.fn(async () => { throw new Error('boom') }) })

    const res = await handlePost(makeInput(), deps)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'exception' })
  })
})

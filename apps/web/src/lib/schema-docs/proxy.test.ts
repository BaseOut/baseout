// Guard for the Schema Docs proxy routes (openspec/changes/shared-schema-docs §4).
// Auth + IDOR + capability gate, before any engine call.

import { describe, expect, it, vi } from 'vitest'
import { guardSchemaDocsRequest, schemaDocsErrorStatus } from './proxy'
import type { AccountContext } from '../account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

const inOrg = vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID }))
const manual = vi.fn(async () => 'manual' as const)

describe('guardSchemaDocsRequest', () => {
  it('401 when not authenticated', async () => {
    const r = await guardSchemaDocsRequest({
      account: null,
      spaceId: SPACE_ID,
      fetchSpace: inOrg,
      resolveLevel: manual,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('400 on a non-UUID spaceId', async () => {
    const r = await guardSchemaDocsRequest({
      account: makeAccount(),
      spaceId: 'nope',
      fetchSpace: inOrg,
      resolveLevel: manual,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
  })

  it('403 space_not_found when the space row is missing', async () => {
    const r = await guardSchemaDocsRequest({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpace: vi.fn(async () => null),
      resolveLevel: manual,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(403)
      expect(((await r.response.json()) as { error: string }).error).toBe('space_not_found')
    }
  })

  it('403 space_org_mismatch when the space is in another org', async () => {
    const r = await guardSchemaDocsRequest({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: 'other' })),
      resolveLevel: manual,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(403)
      expect(((await r.response.json()) as { error: string }).error).toBe('space_org_mismatch')
    }
  })

  it('403 schema_docs_not_entitled when the tier level is none', async () => {
    const r = await guardSchemaDocsRequest({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpace: inOrg,
      resolveLevel: vi.fn(async () => 'none' as const),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(403)
      expect(((await r.response.json()) as { error: string }).error).toBe('schema_docs_not_entitled')
    }
  })

  it('ok:true with the space + level when entitled', async () => {
    const r = await guardSchemaDocsRequest({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpace: inOrg,
      resolveLevel: manual,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.space.id).toBe(SPACE_ID)
      expect(r.level).toBe('manual')
    }
  })
})

describe('schemaDocsErrorStatus', () => {
  it('maps engine error codes to HTTP statuses', () => {
    expect(schemaDocsErrorStatus('unauthorized')).toBe(401)
    expect(schemaDocsErrorStatus('invalid_request')).toBe(400)
    expect(schemaDocsErrorStatus('document_not_found')).toBe(404)
    expect(schemaDocsErrorStatus('space_db_not_ready')).toBe(409)
    expect(schemaDocsErrorStatus('backend_not_implemented')).toBe(501)
    expect(schemaDocsErrorStatus('engine_unreachable')).toBe(502)
    expect(schemaDocsErrorStatus('engine_error')).toBe(500)
  })
})

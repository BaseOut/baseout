/**
 * Tests for the testable inner handler (handleDocuments) of the Schema Docs
 * collection proxy. The guard + error-status mapper are covered in
 * lib/schema-docs/proxy.test.ts; this pins the route glue: 503 when the engine
 * is unconfigured, method dispatch, body validation, and engine result mapping.
 *
 * cloudflare:workers is mocked because importing the route pulls the static
 * `env` import (we never call buildEngine in tests).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleDocuments } = await import('./documents')

import type { AccountContext } from '../../../../lib/account'
import type {
  CreateDocumentResult,
  ListDocumentsResult,
} from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
  } as AccountContext
}

const inOrg = vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID }))
const manual = vi.fn(async () => 'manual' as const)

const baseInput = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  parseBody: async () => ({}),
  userId: 'u_1',
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleDocuments', () => {
  it('401 propagates from the guard when unauthenticated', async () => {
    const res = await handleDocuments({
      ...baseInput,
      account: null,
      method: 'GET',
      engine: { listDocuments: vi.fn(), createDocument: vi.fn() },
    })
    expect(res.status).toBe(401)
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleDocuments({ ...baseInput, method: 'GET', engine: null })
    expect(res.status).toBe(503)
    expect(((await res.json()) as { error: string }).error).toBe('server_misconfigured')
  })

  it('GET returns the engine document list', async () => {
    const documents = [{ id: 'd1', title: 'A', excerpt: null, tagCount: 0 }]
    const listDocuments = vi.fn(async (): Promise<ListDocumentsResult> => ({ ok: true, documents } as ListDocumentsResult))
    const res = await handleDocuments({
      ...baseInput,
      method: 'GET',
      engine: { listDocuments, createDocument: vi.fn() },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, documents })
    expect(listDocuments).toHaveBeenCalledWith(SPACE_ID)
  })

  it('POST 400 when title is missing', async () => {
    const createDocument = vi.fn()
    const res = await handleDocuments({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({ body: [] }),
      engine: { listDocuments: vi.fn(), createDocument },
    })
    expect(res.status).toBe(400)
    expect(createDocument).not.toHaveBeenCalled()
  })

  it('POST creates the document and 201s, injecting createdByUserId', async () => {
    const document = { id: 'd2', title: 'New' }
    const createDocument = vi.fn(async (): Promise<CreateDocumentResult> => ({ ok: true, document } as CreateDocumentResult))
    const res = await handleDocuments({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({ title: 'New' }),
      engine: { listDocuments: vi.fn(), createDocument },
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true, document })
    expect(createDocument).toHaveBeenCalledWith(SPACE_ID, { title: 'New', createdByUserId: 'u_1' })
  })

  it('maps an engine 501 to a 501 with the code', async () => {
    const listDocuments = vi.fn(
      async (): Promise<ListDocumentsResult> => ({ ok: false, code: 'backend_not_implemented', status: 501 }),
    )
    const res = await handleDocuments({
      ...baseInput,
      method: 'GET',
      engine: { listDocuments, createDocument: vi.fn() },
    })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('backend_not_implemented')
  })
})

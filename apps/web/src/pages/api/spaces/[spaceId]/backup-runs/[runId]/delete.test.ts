/**
 * Tests for the testable inner handler (handlePost) in delete.ts.
 *
 * Mirrors cancel.test.ts — `cloudflare:workers` is mocked at module load so
 * the Astro route file imports cleanly, and tests exercise the inner
 * handler directly with vi.fn() deps. Filed by
 * openspec/changes/shared-backup-run-delete (Phase D.2).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./delete')

import type { AccountContext } from '../../../../../../lib/account'
import type { EngineDeleteRunResult } from '../../../../../../lib/backup-engine'
import type { HandlePostDeps } from './delete'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const RUN_ID = '33333333-3333-3333-3333-333333333333'

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

function makeDeps(overrides: Partial<HandlePostDeps> = {}): HandlePostDeps {
  return {
    fetchSpaceById: vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    })),
    fetchRunForSpace: vi.fn(async () => ({
      id: RUN_ID,
      spaceId: SPACE_ID,
    })),
    engineDeleteRun: vi.fn(
      async (): Promise<EngineDeleteRunResult> => ({
        ok: true,
        triggerRunId: 'run_a',
      }),
    ),
    ...overrides,
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handlePost — auth + input validation', () => {
  it('returns 401 when account is null', async () => {
    const res = await handlePost({
      account: null,
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when organization is missing', async () => {
    const res = await handlePost({
      account: makeAccount({ organization: null }),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when spaceId is not a UUID', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: 'not-a-uuid',
      runId: RUN_ID,
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
    expect(await readJson(res)).toEqual({ error: 'invalid_request' })
  })

  it('returns 400 when runId is not a UUID', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: 'not-a-uuid',
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
    expect(await readJson(res)).toEqual({ error: 'invalid_request' })
  })
})

describe('handlePost — IDOR + ownership', () => {
  it('returns 403 space_not_found when fetchSpaceById resolves to null', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps({
        fetchSpaceById: vi.fn(async () => null),
      }),
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_not_found' })
  })

  it('returns 403 space_org_mismatch when the space belongs to a different org', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps({
        fetchSpaceById: vi.fn(async () => ({
          id: SPACE_ID,
          organizationId: 'some-other-org',
        })),
      }),
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_org_mismatch' })
  })

  it('returns 404 when the run does not belong to this space', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps({
        fetchRunForSpace: vi.fn(async () => null),
      }),
    })
    expect(res.status).toBe(404)
    expect(await readJson(res)).toEqual({ error: 'run_not_found' })
  })
})

describe('handlePost — engine pass-through', () => {
  it('returns 202 with triggerRunId on the happy path', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps(),
    })
    expect(res.status).toBe(202)
    expect(await readJson(res)).toEqual({
      ok: true,
      triggerRunId: 'run_a',
    })
  })

  it.each([
    ['run_not_terminal', 409],
    ['delete_in_progress', 409],
    ['run_not_found', 404],
  ] as const)('maps %s → %i', async (code, status) => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps({
        engineDeleteRun: vi.fn(
          async (): Promise<EngineDeleteRunResult> => ({
            ok: false,
            code,
            status,
          }),
        ),
      }),
    })
    expect(res.status).toBe(status)
    expect(await readJson(res)).toEqual({ error: code })
  })

  it('returns 503 when the engine is unreachable', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps({
        engineDeleteRun: vi.fn(
          async (): Promise<EngineDeleteRunResult> => ({
            ok: false,
            code: 'engine_unreachable',
            status: 0,
          }),
        ),
      }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 502 when the engine returns unauthorized (token mismatch)', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      runId: RUN_ID,
      deps: makeDeps({
        engineDeleteRun: vi.fn(
          async (): Promise<EngineDeleteRunResult> => ({
            ok: false,
            code: 'unauthorized',
            status: 401,
          }),
        ),
      }),
    })
    expect(res.status).toBe(502)
  })
})

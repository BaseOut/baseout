/**
 * Tests for the workspace listing/enrollment route handlers
 * (web-workspace-bases tasks 3.1 + 3.2). rescan-bases test pattern:
 * `cloudflare:workers` mocked, deps injected.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AccountContext } from '../../../../lib/account'
import type { EngineListWorkspacesResult } from '../../../../lib/backup-engine'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleGet, handlePut, parseEnrollmentBody, DEGRADED_RESPONSE_BODY } =
  await import('./workspaces')

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@acme.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [],
  }
}

const spaceRow = { id: SPACE_ID, organizationId: ORG_ID }

const emptyEnrollment = {
  rows: [],
  autoEnrollNewWorkspaces: false,
  legacyAutoAddFutureBases: true,
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handleGet', () => {
  it('guards: 401 / 400 / 403', async () => {
    const base = {
      fetchSpaceById: vi.fn().mockResolvedValue(spaceRow),
      loadEnrollment: vi.fn().mockResolvedValue(emptyEnrollment),
      listWorkspaces: null,
    }
    expect(
      (await handleGet({ ...base, account: null, spaceId: SPACE_ID })).status,
    ).toBe(401)
    expect(
      (await handleGet({ ...base, account: makeAccount(), spaceId: 'nope' })).status,
    ).toBe(400)
    expect(
      (
        await handleGet({
          ...base,
          account: makeAccount(),
          spaceId: SPACE_ID,
          fetchSpaceById: vi
            .fn()
            .mockResolvedValue({ id: SPACE_ID, organizationId: 'other-org' }),
        })
      ).status,
    ).toBe(403)
  })

  it.each<[string, (() => Promise<EngineListWorkspacesResult>) | null]>([
    ['engine binding unavailable', null],
    [
      'engine degraded payload',
      () =>
        Promise.resolve({
          ok: false,
          degraded: true,
          reason: 'mcp_scope_missing',
          status: 200,
        }),
    ],
    [
      'engine 404 while server half is unbuilt',
      () =>
        Promise.resolve({
          ok: false,
          degraded: true,
          reason: 'engine_error',
          status: 404,
        }),
    ],
  ])('degrades to the ungrouped 200 response when %s', async (_label, listWorkspaces) => {
    const res = await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById: vi.fn().mockResolvedValue(spaceRow),
      loadEnrollment: vi.fn().mockResolvedValue(emptyEnrollment),
      listWorkspaces,
    })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual(DEGRADED_RESPONSE_BODY)
  })

  it('merges the engine listing with enrollment rows', async () => {
    const res = await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById: vi.fn().mockResolvedValue(spaceRow),
      loadEnrollment: vi.fn().mockResolvedValue({
        rows: [
          {
            workspaceId: 'wspA',
            workspaceName: 'Ops',
            autoEnrollFutureBases: true,
            enrolledVia: 'manual',
            lastCheckedAt: '2026-07-27T00:00:00.000Z',
          },
          {
            workspaceId: 'wspGone',
            workspaceName: 'Old',
            autoEnrollFutureBases: false,
            enrolledVia: 'auto',
            lastCheckedAt: null,
          },
        ],
        autoEnrollNewWorkspaces: true,
        legacyAutoAddFutureBases: true,
      }),
      listWorkspaces: () =>
        Promise.resolve({
          ok: true,
          workspaces: [
            { id: 'wspA', name: 'Ops', permissionLevel: 'owner' },
            { id: 'wspB', name: 'Marketing' },
          ],
          capturedAt: '2026-07-27T10:00:00.000Z',
        }),
    })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.ok).toBe(true)
    expect(body.policySource).toBe('rows')
    expect(body.autoEnrollNewWorkspaces).toBe(true)
    const workspaces = body.workspaces as Array<Record<string, unknown>>
    expect(workspaces).toHaveLength(3)
    expect(workspaces.find((w) => w.id === 'wspA')).toMatchObject({
      enrolled: true,
      autoEnrollFutureBases: true,
      enrolledVia: 'manual',
    })
    expect(workspaces.find((w) => w.id === 'wspB')).toMatchObject({
      enrolled: false,
      autoEnrollFutureBases: false,
    })
    // Enrolled-but-unlisted workspace stays visible for un-enrollment.
    expect(workspaces.find((w) => w.id === 'wspGone')).toMatchObject({
      enrolled: true,
      enrolledVia: 'auto',
    })
  })

  it('reports legacy policy source when no rows exist', async () => {
    const res = await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById: vi.fn().mockResolvedValue(spaceRow),
      loadEnrollment: vi.fn().mockResolvedValue(emptyEnrollment),
      listWorkspaces: () =>
        Promise.resolve({ ok: true, workspaces: [], capturedAt: null }),
    })
    const body = await readJson(res)
    expect(body.policySource).toBe('legacy')
  })
})

describe('parseEnrollmentBody', () => {
  it('accepts upserts + removals + the standing flag', () => {
    const parsed = parseEnrollmentBody({
      workspaces: [
        { workspaceId: 'wspA', workspaceName: 'Ops', autoEnrollFutureBases: true },
        { workspaceId: 'wspB' },
      ],
      remove: ['wspC'],
      autoEnrollNewWorkspaces: true,
    })
    expect(parsed).toEqual({
      ok: true,
      value: {
        workspaces: [
          { workspaceId: 'wspA', workspaceName: 'Ops', autoEnrollFutureBases: true },
          { workspaceId: 'wspB', workspaceName: null, autoEnrollFutureBases: false },
        ],
        remove: ['wspC'],
        autoEnrollNewWorkspaces: true,
      },
    })
  })

  it('rejects malformed input', () => {
    expect(parseEnrollmentBody(null).ok).toBe(false)
    expect(parseEnrollmentBody({}).ok).toBe(false) // empty_request
    expect(parseEnrollmentBody({ workspaces: 'x' }).ok).toBe(false)
    expect(parseEnrollmentBody({ workspaces: [{ workspaceId: '' }] }).ok).toBe(false)
    expect(parseEnrollmentBody({ workspaces: [{ workspaceId: 'a', autoEnrollFutureBases: 'yes' }] }).ok).toBe(false)
    expect(parseEnrollmentBody({ remove: [1] }).ok).toBe(false)
    expect(parseEnrollmentBody({ autoEnrollNewWorkspaces: 'true' }).ok).toBe(false)
    expect(
      parseEnrollmentBody({
        workspaces: [{ workspaceId: 'a' }],
        remove: ['a'],
      }).ok,
    ).toBe(false)
    expect(
      parseEnrollmentBody({
        workspaces: Array.from({ length: 201 }, (_, i) => ({ workspaceId: `w${i}` })),
      }).ok,
    ).toBe(false)
  })
})

describe('handlePut', () => {
  it('guards and validates, then applies', async () => {
    const applyEnrollment = vi.fn().mockResolvedValue({ enrolled: 1, removed: 0 })
    const res = await handlePut({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { workspaces: [{ workspaceId: 'wspA', autoEnrollFutureBases: true }] },
      fetchSpaceById: vi.fn().mockResolvedValue(spaceRow),
      applyEnrollment,
    })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ ok: true, enrolled: 1, removed: 0 })
    expect(applyEnrollment).toHaveBeenCalledWith({
      workspaces: [
        { workspaceId: 'wspA', workspaceName: null, autoEnrollFutureBases: true },
      ],
      remove: [],
      autoEnrollNewWorkspaces: null,
    })
  })

  it('400 on invalid body; 401/403 guards', async () => {
    const base = {
      fetchSpaceById: vi.fn().mockResolvedValue(spaceRow),
      applyEnrollment: vi.fn(),
    }
    expect(
      (
        await handlePut({
          ...base,
          account: makeAccount(),
          spaceId: SPACE_ID,
          body: {},
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await handlePut({
          ...base,
          account: null,
          spaceId: SPACE_ID,
          body: {},
        })
      ).status,
    ).toBe(401)
  })
})

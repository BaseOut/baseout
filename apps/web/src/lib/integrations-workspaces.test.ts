/**
 * deriveWorkspaceEnrollments — the pure mapper from persisted
 * space_workspaces rows onto the picker's WorkspaceEnrollment model
 * (web-workspace-bases promotion).
 */

import { describe, expect, it } from 'vitest'
import { deriveWorkspaceEnrollments } from './integrations'

const AT = new Date('2026-07-28T12:00:00.000Z')

describe('deriveWorkspaceEnrollments', () => {
  it('maps rows and counts included bases per workspace', () => {
    const out = deriveWorkspaceEnrollments(
      [
        {
          workspaceId: 'wspA',
          workspaceName: 'Marketing',
          autoEnrollFutureBases: true,
          enrolledVia: 'manual',
          lastCheckedAt: AT,
        },
        {
          workspaceId: 'wspB',
          workspaceName: 'Ops',
          autoEnrollFutureBases: false,
          enrolledVia: 'auto',
          lastCheckedAt: null,
        },
      ],
      [
        { workspaceId: 'wspA', isIncluded: true },
        { workspaceId: 'wspA', isIncluded: true },
        { workspaceId: 'wspA', isIncluded: false },
        { workspaceId: 'wspB', isIncluded: true },
        { workspaceId: null, isIncluded: true },
      ],
    )
    expect(out).toEqual([
      {
        workspaceId: 'wspA',
        workspaceName: 'Marketing',
        autoAdd: true,
        enrolledVia: 'manual',
        includedBaseCount: 2,
        lastCheckedAt: '2026-07-28T12:00:00.000Z',
      },
      {
        workspaceId: 'wspB',
        workspaceName: 'Ops',
        autoAdd: false,
        enrolledVia: 'auto',
        includedBaseCount: 1,
        lastCheckedAt: null,
      },
    ])
  })

  it('orders by name, unnamed (placeholder "Workspace N") workspaces last by id', () => {
    const out = deriveWorkspaceEnrollments(
      [
        { workspaceId: 'wsp2', workspaceName: null, autoEnrollFutureBases: false, enrolledVia: 'manual', lastCheckedAt: null },
        { workspaceId: 'wspZ', workspaceName: 'Zeta', autoEnrollFutureBases: false, enrolledVia: 'manual', lastCheckedAt: null },
        { workspaceId: 'wsp1', workspaceName: null, autoEnrollFutureBases: false, enrolledVia: 'manual', lastCheckedAt: null },
        { workspaceId: 'wspA', workspaceName: 'Alpha', autoEnrollFutureBases: false, enrolledVia: 'manual', lastCheckedAt: null },
      ],
      [],
    )
    expect(out.map((w) => w.workspaceId)).toEqual(['wspA', 'wspZ', 'wsp1', 'wsp2'])
    expect(out[2]?.workspaceName).toBe('')
  })

  it('unknown enrolledVia values degrade to manual (never invent auto)', () => {
    const out = deriveWorkspaceEnrollments(
      [{ workspaceId: 'wspX', workspaceName: 'X', autoEnrollFutureBases: false, enrolledVia: 'weird', lastCheckedAt: null }],
      [],
    )
    expect(out[0]?.enrolledVia).toBe('manual')
  })
})

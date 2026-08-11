/**
 * Workspace stamping in the at_bases persist path
 * (web-workspace-bases task 2.1). The COALESCE null-tolerance in the
 * onConflict set-list is exercised at smoke time against real PG; this
 * unit-pins the value mapping: stamp when provided, null when absent.
 */

import { describe, expect, it } from 'vitest'
import { mapBasesToUpsertRows } from './persist'

const NOW = new Date('2026-07-27T12:00:00Z')

describe('mapBasesToUpsertRows', () => {
  it('stamps workspace fields when provided', () => {
    const rows = mapBasesToUpsertRows(
      [
        {
          id: 'appA',
          name: 'CRM',
          permissionLevel: 'owner',
          workspaceId: 'wsp1',
          workspaceName: 'Ops',
        },
      ],
      'space_1',
      NOW,
    )
    expect(rows).toEqual([
      {
        spaceId: 'space_1',
        atBaseId: 'appA',
        name: 'CRM',
        workspaceId: 'wsp1',
        workspaceName: 'Ops',
        lastSeenAt: NOW,
      },
    ])
  })

  it('is null-tolerant: absent workspace data persists as NULL, never blocks', () => {
    const rows = mapBasesToUpsertRows(
      [{ id: 'appB', name: 'HR', permissionLevel: 'read' }],
      'space_1',
      NOW,
    )
    expect(rows[0].workspaceId).toBeNull()
    expect(rows[0].workspaceName).toBeNull()
  })
})

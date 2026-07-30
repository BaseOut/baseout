/**
 * Legacy autoAddFutureBases vs space_workspaces rows precedence
 * (web-workspace-bases design Decision 3 + spec "Legacy auto-add flag
 * yields to workspace rows"). This module is the cross-repo contract —
 * server-mcp-workspaces implements the same rule engine-side.
 */

import { describe, expect, it } from 'vitest'
import {
  isWorkspaceAutoAddEnabled,
  resolveWorkspaceAutoAddPolicy,
} from './workspace-precedence'

const row = (workspaceId: string, autoAdd: boolean) => ({
  workspaceId,
  autoEnrollFutureBases: autoAdd,
})

describe('resolveWorkspaceAutoAddPolicy', () => {
  it('no rows → legacy flag governs, meaning ALL workspaces incl. future', () => {
    const policy = resolveWorkspaceAutoAddPolicy({
      legacyAutoAddFutureBases: true,
      autoEnrollNewWorkspaces: false,
      rows: [],
    })
    expect(policy).toEqual({
      source: 'legacy',
      autoAddAllWorkspaces: true,
      autoEnrollNewWorkspaces: true,
      rows: [],
    })
  })

  it('no rows + legacy off → nothing auto-adds', () => {
    const policy = resolveWorkspaceAutoAddPolicy({
      legacyAutoAddFutureBases: false,
      autoEnrollNewWorkspaces: false,
      rows: [],
    })
    expect(policy.source).toBe('legacy')
    expect(policy.autoAddAllWorkspaces).toBe(false)
    expect(policy.autoEnrollNewWorkspaces).toBe(false)
  })

  it('any row present → rows govern and the legacy flag is ignored', () => {
    const policy = resolveWorkspaceAutoAddPolicy({
      legacyAutoAddFutureBases: true, // must be inert
      autoEnrollNewWorkspaces: false,
      rows: [row('wspA', true), row('wspB', false)],
    })
    expect(policy).toEqual({
      source: 'rows',
      autoAddAllWorkspaces: false,
      autoEnrollNewWorkspaces: false,
      rows: [row('wspA', true), row('wspB', false)],
    })
  })
})

describe('isWorkspaceAutoAddEnabled', () => {
  it('legacy mode: every workspace (known or not) follows the legacy flag', () => {
    const on = resolveWorkspaceAutoAddPolicy({
      legacyAutoAddFutureBases: true,
      autoEnrollNewWorkspaces: false,
      rows: [],
    })
    expect(isWorkspaceAutoAddEnabled(on, 'wspA')).toBe(true)
    expect(isWorkspaceAutoAddEnabled(on, null)).toBe(true)
  })

  it('rows mode: per-row flag; unknown workspaces follow autoEnrollNewWorkspaces', () => {
    const policy = resolveWorkspaceAutoAddPolicy({
      legacyAutoAddFutureBases: true,
      autoEnrollNewWorkspaces: true,
      rows: [row('wspA', true), row('wspB', false)],
    })
    expect(isWorkspaceAutoAddEnabled(policy, 'wspA')).toBe(true)
    // Explicit opt-out survives the standing flag (spec scenario).
    expect(isWorkspaceAutoAddEnabled(policy, 'wspB')).toBe(false)
    // Never-seen workspace → standing flag.
    expect(isWorkspaceAutoAddEnabled(policy, 'wspNEW')).toBe(true)
    // Base with no workspace identity (null-tolerant): not auto-added in
    // rows mode — grouping data absent means no enrollment can claim it.
    expect(isWorkspaceAutoAddEnabled(policy, null)).toBe(false)
  })
})

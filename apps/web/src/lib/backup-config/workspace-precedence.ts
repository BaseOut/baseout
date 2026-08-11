/**
 * Workspace auto-add precedence (web-workspace-bases design Decision 3).
 *
 * The rule this module pins — the cross-repo contract read by
 * server-mcp-workspaces:
 *
 *   - NO space_workspaces rows → the legacy connection-wide
 *     backup_configurations.auto_add_future_bases flag governs, interpreted
 *     as "all workspaces of the connection, including future ones"
 *     (current behavior preserved exactly).
 *   - ANY row present → the rows + backup_configurations.
 *     auto_enroll_new_workspaces are authoritative; the legacy flag is
 *     inert for that Space. (The first save from the new UI materializes
 *     rows — Spaces migrate lazily on first edit; no backfill.)
 */

export interface WorkspaceEnrollmentRow {
  workspaceId: string
  autoEnrollFutureBases: boolean
}

export interface WorkspaceAutoAddPolicy {
  source: 'legacy' | 'rows'
  /** Legacy mode only: auto-add applies to every workspace. */
  autoAddAllWorkspaces: boolean
  /** Whether a NOT-YET-KNOWN workspace auto-enrolls on first sighting. */
  autoEnrollNewWorkspaces: boolean
  rows: WorkspaceEnrollmentRow[]
}

export function resolveWorkspaceAutoAddPolicy(inputs: {
  legacyAutoAddFutureBases: boolean
  autoEnrollNewWorkspaces: boolean
  rows: WorkspaceEnrollmentRow[]
}): WorkspaceAutoAddPolicy {
  if (inputs.rows.length === 0) {
    return {
      source: 'legacy',
      autoAddAllWorkspaces: inputs.legacyAutoAddFutureBases,
      // Legacy "all workspaces" necessarily covers future workspaces too.
      autoEnrollNewWorkspaces: inputs.legacyAutoAddFutureBases,
      rows: [],
    }
  }
  return {
    source: 'rows',
    autoAddAllWorkspaces: false,
    autoEnrollNewWorkspaces: inputs.autoEnrollNewWorkspaces,
    rows: inputs.rows,
  }
}

/**
 * Would a newly discovered base in `workspaceId` auto-add under `policy`?
 * `null` workspaceId = base without workspace identity (nullable-first,
 * design Decision 5): auto-adds only under the legacy all-workspaces mode.
 */
export function isWorkspaceAutoAddEnabled(
  policy: WorkspaceAutoAddPolicy,
  workspaceId: string | null,
): boolean {
  if (policy.source === 'legacy') return policy.autoAddAllWorkspaces
  if (workspaceId === null) return false
  const enrolled = policy.rows.find((r) => r.workspaceId === workspaceId)
  if (enrolled) return enrolled.autoEnrollFutureBases
  return policy.autoEnrollNewWorkspaces
}

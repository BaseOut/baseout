// Workspace auto-enroll decision — PURE (no I/O), unit-tested
// (server-mcp-workspaces; schema + precedence rules owned by
// web-workspace-bases).
//
// Runs as a processRunStart pre-step (design Decision 2 — "on each backup
// run, check for new bases since our last sync"): given the connection's
// CURRENT workspace listing (with base membership), the Space's enrollment
// rows, the standing new-workspaces flag, and the configured base set, decide
//   - which workspaces to auto-enroll (standing flag, `enrolled_via='auto'` —
//     existing rows are NEVER modified: explicit opt-outs stand),
//   - which bases to add (ordered workspace-order-then-base-name, stopping at
//     the bases-per-Space cap — design Decision 3),
//   - which bases were skipped by the cap (distinct "plan limit" notification;
//     re-considered next run — idempotent by base-id diff, no skip-list state).
//
// Legacy precedence (web-workspace-bases design Decision 3): a Space with NO
// space_workspaces rows is governed by the connection-wide legacy
// autoAddFutureBases flag, interpreted as "all workspaces including future
// ones" — no rows are materialized (Spaces migrate lazily on first UI save).
// Once any row exists, rows + the standing flag are authoritative and the
// legacy flag is ignored.
//
// NOTE (spike 2026-07-27, ../server-mcp-workspaces/README.md): the MCP
// workspace listing is 403-blocked on the current OAuth grant — the FETCH
// layer degrades to a skip until `workspacesAndBases:read` lands (Features
// §17 Q20). This module is fully buildable and tested against injected data.

export interface EnrolledWorkspace {
  workspaceId: string;
  autoEnrollFutureBases: boolean;
}

/** One workspace from the connection's current listing, with base membership. */
export interface WorkspaceListingEntry {
  workspaceId: string;
  workspaceName: string | null;
  bases: { atBaseId: string; name: string }[];
}

export interface AutoEnrollCandidate {
  workspaceId: string;
  workspaceName: string | null;
  atBaseId: string;
  name: string;
}

export interface AutoEnrollDecision {
  /** New workspaces to materialize as enrolled_via='auto' rows (standing flag). */
  workspacesToEnroll: { workspaceId: string; workspaceName: string | null }[];
  /** Bases to add, in order, within the cap. */
  toAdd: AutoEnrollCandidate[];
  /** Bases skipped by the cap ("new bases paused — plan limit"). */
  skipped: AutoEnrollCandidate[];
}

export function decideAutoEnroll(args: {
  /** The Space's space_workspaces rows (empty = legacy precedence). */
  enrolled: EnrolledWorkspace[];
  /** backup_configurations.auto_enroll_new_workspaces (standing flag). */
  autoEnrollNewWorkspaces: boolean;
  /** backup_configurations.auto_add_future_bases (legacy, connection-wide). */
  legacyAutoAddFutureBases: boolean;
  /** The connection's current workspace listing (listing order preserved). */
  listing: WorkspaceListingEntry[];
  /** at_base_ids already configured (included OR excluded) for the Space. */
  configuredBaseIds: Set<string>;
  /** Tier bases-per-Space cap (null = unlimited) + current included count. */
  cap: number | null;
  currentIncludedCount: number;
}): AutoEnrollDecision {
  const {
    enrolled,
    autoEnrollNewWorkspaces,
    legacyAutoAddFutureBases,
    listing,
    configuredBaseIds,
    cap,
    currentIncludedCount,
  } = args;

  const workspacesToEnroll: AutoEnrollDecision["workspacesToEnroll"] = [];
  let candidateWorkspaces: WorkspaceListingEntry[];

  if (enrolled.length === 0) {
    // Legacy precedence: no rows → the legacy flag means "all workspaces,
    // including future ones"; off means no auto-add at all. No rows are
    // materialized either way (lazy migration on first UI save).
    candidateWorkspaces = legacyAutoAddFutureBases ? listing : [];
  } else {
    const byId = new Map(enrolled.map((e) => [e.workspaceId, e]));
    candidateWorkspaces = [];
    for (const ws of listing) {
      const row = byId.get(ws.workspaceId);
      if (row) {
        // Existing rows are never modified — opt-outs stand.
        if (row.autoEnrollFutureBases) candidateWorkspaces.push(ws);
        continue;
      }
      // Unknown workspace: the standing flag governs the unknown→known
      // transition only (web-workspace-bases design Decision 2b).
      if (autoEnrollNewWorkspaces) {
        workspacesToEnroll.push({ workspaceId: ws.workspaceId, workspaceName: ws.workspaceName });
        candidateWorkspaces.push(ws);
      }
    }
  }

  const candidates: AutoEnrollCandidate[] = [];
  for (const ws of candidateWorkspaces) {
    const bases = [...ws.bases].sort((a, b) => a.name.localeCompare(b.name));
    for (const base of bases) {
      if (configuredBaseIds.has(base.atBaseId)) continue;
      candidates.push({
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        atBaseId: base.atBaseId,
        name: base.name,
      });
    }
  }

  const remaining =
    cap === null ? Number.POSITIVE_INFINITY : Math.max(0, cap - currentIncludedCount);
  const toAdd = candidates.slice(0, remaining === Number.POSITIVE_INFINITY ? undefined : remaining);
  const skipped = candidates.slice(toAdd.length);

  return { workspacesToEnroll, toAdd, skipped };
}

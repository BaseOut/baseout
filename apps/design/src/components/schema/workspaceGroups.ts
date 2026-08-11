/**
 * Shared workspace-grouping helper (workspace-visual-grouping). Splits a list of
 * base-shaped items by their Airtable workspace, name-ordered, with a final
 * "Workspace unknown" group for anything the engine couldn't attribute — the exact
 * grouping shape BaseSelectionTable.astro established for the base picker
 * (base-picker-workspace-grouping), reused here so the FacetFilter dropdowns group
 * the same way the picker does.
 */
export interface WorkspaceGroupable {
  workspaceId?: string;
  workspaceName?: string;
}

export interface WorkspaceGroup<T> {
  /** Stable group id — the workspace id, or the shared "unknown" sentinel. */
  id: string;
  /** Display name — the workspace name, or "Workspace unknown". */
  name: string;
  /** True for the synthetic "no workspace" bucket — it carries no "Airtable workspace" label. */
  unknown: boolean;
  items: T[];
}

export const UNKNOWN_WORKSPACE_ID = '__unknown__';

/** Group items by workspace; unknown last, real groups name-ordered. */
export function groupByWorkspace<T extends WorkspaceGroupable>(items: T[]): WorkspaceGroup<T>[] {
  const map = new Map<string, WorkspaceGroup<T>>();
  for (const item of items) {
    const id = item.workspaceId ?? UNKNOWN_WORKSPACE_ID;
    const name = item.workspaceName ?? 'No workspace';
    let g = map.get(id);
    if (!g) {
      g = { id, name, unknown: id === UNKNOWN_WORKSPACE_ID, items: [] };
      map.set(id, g);
    }
    g.items.push(item);
  }
  return [...map.values()].sort((a, b) => {
    if (a.unknown) return 1;
    if (b.unknown) return -1;
    return a.name.localeCompare(b.name);
  });
}

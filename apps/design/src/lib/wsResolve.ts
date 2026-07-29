/**
 * Harness-only switch for the base picker's progressive workspace grouping.
 *
 * Getting a base's workspace costs one extra Airtable API call PER BASE, so in
 * production the map arrives late and in pieces. There is no backend here, so
 * `?wsresolve=` fakes each moment of that arrival against the real fixtures.
 *
 * V2 (2026-07-29): grouped is the DEFAULT — the table groups ITSELF the moment
 * matching completes, so `resolving` now ends in a grouped table rather than in
 * an offer. `offered` was kept but re-purposed: it is the one state that is
 * finished AND ungrouped, i.e. the user who deliberately switched grouping off.
 *
 *   flat      → nothing running; the plain flat table, no band and no bar at all
 *   resolving → the card-edge bar, ticking; the table stays selectable, and when
 *               the bar finishes the rows regroup themselves in one animated move
 *   offered   → finished, but grouping is OFF because the user turned it off
 *   grouped   → finished and grouped — the resting state for a return visit
 *   partial   → finished + grouped, but a slice of bases is still unmatched →
 *               they land in a "Still matching" group, never in "No workspace"
 *   failed    → the lookup gave up; flat, bar stopped and NEUTRAL, with a Retry
 *   resumed   → a reload mid-run: the counter picks up part-way, never at 0
 */
import type { BaseSummary, WorkspaceAlias, WorkspaceResolveState } from '@web/stores/connections';

export type WsResolveKey =
  | 'flat'
  | 'resolving'
  | 'offered'
  | 'grouped'
  | 'partial'
  | 'failed'
  | 'resumed';

const KEYS: WsResolveKey[] = ['flat', 'resolving', 'offered', 'grouped', 'partial', 'failed', 'resumed'];

export function readWsResolveKey(url: URL, fallback: WsResolveKey = 'resolving'): WsResolveKey {
  const raw = (url.searchParams.get('wsresolve') ?? '').toLowerCase();
  return (KEYS as string[]).includes(raw) ? (raw as WsResolveKey) : fallback;
}

export interface WsResolveProps {
  wsResolve: WorkspaceResolveState;
  wsResolvedCount: number;
  wsTotalCount: number;
  groupByWorkspace: boolean;
}

/** The picker props for a given demo state, sized against the fixture's base count. */
export function wsResolveProps(key: WsResolveKey, baseCount: number): WsResolveProps {
  const total = baseCount;
  switch (key) {
    case 'flat':
      return { wsResolve: 'off', wsResolvedCount: 0, wsTotalCount: total, groupByWorkspace: false };
    case 'resolving':
      // Deliberately a small head start: a counter that has moved reads as work
      // in progress, where 0 / N reads as work that has not begun.
      return { wsResolve: 'resolving', wsResolvedCount: Math.min(4, total), wsTotalCount: total, groupByWorkspace: false };
    case 'resumed':
      // The reload case. Progress is never thrown away, so the counter picks up
      // where the run got to.
      return { wsResolve: 'resolving', wsResolvedCount: Math.floor(total * 0.67), wsTotalCount: total, groupByWorkspace: false };
    case 'offered':
      // The ungrouped END state: matching is done and the user said no.
      return { wsResolve: 'ready', wsResolvedCount: total, wsTotalCount: total, groupByWorkspace: false };
    case 'partial':
      return { wsResolve: 'ready', wsResolvedCount: total, wsTotalCount: total, groupByWorkspace: true };
    case 'grouped':
      return { wsResolve: 'ready', wsResolvedCount: total, wsTotalCount: total, groupByWorkspace: true };
    case 'failed':
      return { wsResolve: 'failed', wsResolvedCount: 0, wsTotalCount: total, groupByWorkspace: false };
  }
}

/**
 * `partial` only: mark a slice of bases as still awaiting their own lookup.
 *
 * `workspacePending` is its OWN flag, never "no workspaceId" — a base we have
 * not asked about yet is a different fact from a base with no workspace, and
 * the picker keeps them in two different buckets with two different labels.
 */
export function markPending<T extends BaseSummary>(bases: T[], key: WsResolveKey): T[] {
  if (key !== 'partial') return bases;
  const from = Math.max(1, Math.floor(bases.length * 0.75));
  return bases.map((b, i) => (i >= from ? { ...b, workspacePending: true } : b));
}

/**
 * `?wsalias=` — item 6, the alias swap, which only becomes visible once a
 * workspace has BOTH a name the user typed and a real Airtable name.
 *
 *   arrived → the user filled in a blank name ('placeholder-fill'); Airtable's
 *             name has now landed and takes over, with ONE reversible prompt
 *   custom  → they already answered "Keep mine", so the alias is 'custom' and
 *             both names show — theirs leading, Airtable's muted beside it
 *
 * Off by default: dual display is EARNED, never the resting state.
 */
export type WsAliasKey = 'off' | 'arrived' | 'custom';

export function readWsAliasKey(url: URL): WsAliasKey {
  const raw = (url.searchParams.get('wsalias') ?? '').toLowerCase();
  return raw === 'arrived' || raw === 'custom' ? raw : 'off';
}

/** Attach the user's typed name to the FIRST workspace present in the fixture. */
export function wsAliases(key: WsAliasKey, bases: BaseSummary[]): WorkspaceAlias[] {
  if (key === 'off') return [];
  const first = bases.find((b) => b.workspaceId && b.workspaceName);
  if (!first?.workspaceId) return [];
  return [{ workspaceId: first.workspaceId, alias: 'Marketing', kind: key === 'custom' ? 'custom' : 'placeholder-fill' }];
}

// I/O layer for the record-history route (server-data-browse Task 3.2). Feeds
// the pure reconstruction in record-history.ts real rows: the record's
// first_seen_run / first_unseen_run markers, every bo_at_record_updates row (the
// OLD value logged at each run), and the current bo_at_record_field_data values.
//
// bo_at_base_runs has no explicit sequence column (time lives on started_at /
// completed_at), so run ordering is DERIVED here (`assignRunSeq`) from started_at
// with a completed_at fallback and a run-id tiebreak — a dense integer rank over
// exactly the runs this record touches, which is all buildRecordHistory /
// recordStateAsOf compare against. The pure builders + assignRunSeq are
// rendered-SQL / unit-tested in data-record-history-io.test.ts; live-PG behavior
// is the deferred integration smoke (Task 5.1).

import { sql, type SQL } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'
import {
  buildRecordHistory,
  recordStateAsOf,
  type FieldValue,
  type HistoryEntry,
  type RecordUpdate,
  type RunMarker,
} from './record-history'

function tsIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function decodeValue(v: string | null): unknown {
  if (v == null) return null
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

// ── Run ordering (pure) ──────────────────────────────────────────────────────

export interface RunTimeRow {
  runId: string
  startedAt: string | null
  completedAt: string | null
}

/**
 * Assign a dense ascending seq (0 = oldest) to a set of runs, ordered by
 * started_at (completed_at fallback, then run id) so the ordering is total and
 * deterministic even when timestamps tie or are null. ISO timestamps compare
 * correctly as strings.
 */
export function assignRunSeq(runs: RunTimeRow[]): Map<string, number> {
  const keyOf = (r: RunTimeRow) => r.startedAt ?? r.completedAt ?? ''
  const sorted = [...runs].sort((a, b) => {
    const ka = keyOf(a)
    const kb = keyOf(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0
  })
  const map = new Map<string, number>()
  sorted.forEach((r, i) => map.set(r.runId, i))
  return map
}

// ── SQL builders (pure) ──────────────────────────────────────────────────────

export function recordMarkersQuery(recordId: string): SQL {
  return sql`
    select record_id, first_seen_run, first_unseen_run
    from bo_at_records
    where record_id = ${recordId}
    limit 1
  `
}

export function recordUpdatesQuery(recordId: string): SQL {
  return sql`
    select field_id, run_id, old_value
    from bo_at_record_updates
    where record_id = ${recordId}
  `
}

export function currentFieldDataQuery(recordId: string): SQL {
  return sql`
    select field_id, value
    from bo_at_record_field_data
    where record_id = ${recordId}
  `
}

export function baseRunsByIdsQuery(runIds: string[]): SQL {
  const idList = sql.join(
    runIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )
  return sql`
    select id, started_at, completed_at
    from bo_at_base_runs
    where id in (${idList})
  `
}

// ── Fetch + assemble ─────────────────────────────────────────────────────────

/** Resolve the seq + display timestamp for a set of run ids. Ids that carry no
 *  bo_at_base_runs row (should not happen for real data) still get a seq so the
 *  history stays total. */
async function loadRuns(
  tx: SpaceTx,
  runIds: Set<string>,
): Promise<{ seqMap: Map<string, number>; atById: Map<string, string | null> }> {
  const ids = [...runIds]
  const rows = ids.length
    ? [
        ...((await tx.execute(baseRunsByIdsQuery(ids))) as unknown as Iterable<{
          id: string
          started_at: unknown
          completed_at: unknown
        }>),
      ]
    : []
  const seqInput: RunTimeRow[] = rows.map((r) => ({
    runId: r.id,
    startedAt: tsIso(r.started_at),
    completedAt: tsIso(r.completed_at),
  }))
  const atById = new Map<string, string | null>(seqInput.map((r) => [r.runId, r.startedAt ?? r.completedAt]))
  for (const id of ids) {
    if (!atById.has(id)) {
      seqInput.push({ runId: id, startedAt: null, completedAt: null })
      atById.set(id, null)
    }
  }
  return { seqMap: assignRunSeq(seqInput), atById }
}

export interface HistoryMarker {
  runId: string
  seq: number
  at: string | null
}

export interface RecordHistoryResult {
  entries: (HistoryEntry & { at: string | null })[]
  created: HistoryMarker | null
  deleted: HistoryMarker | null
}

/**
 * Reconstruct a record's full timeline, newest run first. `null` when the record
 * does not exist (→ 404 at the route). Each entry is enriched with the run's
 * display timestamp (`at`); `created` / `deleted` echo the first-seen /
 * first-unseen markers with their run timestamps.
 */
export async function fetchRecordHistory(
  tx: SpaceTx,
  recordId: string,
): Promise<RecordHistoryResult | null> {
  const recRows = (await tx.execute(recordMarkersQuery(recordId))) as unknown as Iterable<{
    record_id: string
    first_seen_run: string | null
    first_unseen_run: string | null
  }>
  const rec = [...recRows][0]
  if (!rec) return null

  const updateRows = [
    ...((await tx.execute(recordUpdatesQuery(recordId))) as unknown as Iterable<{
      field_id: string
      run_id: string
      old_value: string | null
    }>),
  ]
  const currentRows = [
    ...((await tx.execute(currentFieldDataQuery(recordId))) as unknown as Iterable<{
      field_id: string
      value: string | null
    }>),
  ]

  const runIds = new Set<string>()
  for (const u of updateRows) if (u.run_id) runIds.add(u.run_id)
  if (rec.first_seen_run) runIds.add(rec.first_seen_run)
  if (rec.first_unseen_run) runIds.add(rec.first_unseen_run)
  const { seqMap, atById } = await loadRuns(tx, runIds)

  const updates: RecordUpdate[] = updateRows.map((u) => ({
    fieldId: u.field_id,
    runId: u.run_id,
    runSeq: seqMap.get(u.run_id) ?? 0,
    oldValue: u.old_value,
  }))
  const current: FieldValue[] = currentRows.map((c) => ({ fieldId: c.field_id, value: c.value }))
  const firstSeen: RunMarker | null = rec.first_seen_run
    ? { runId: rec.first_seen_run, seq: seqMap.get(rec.first_seen_run) ?? 0 }
    : null
  const firstUnseen: RunMarker | null = rec.first_unseen_run
    ? { runId: rec.first_unseen_run, seq: seqMap.get(rec.first_unseen_run) ?? 0 }
    : null

  const entries = buildRecordHistory({ current, updates, firstSeen, firstUnseen }).map((e) => ({
    ...e,
    at: atById.get(e.runId) ?? null,
  }))
  const toMarker = (m: RunMarker | null): HistoryMarker | null =>
    m ? { runId: m.runId, seq: m.seq, at: atById.get(m.runId) ?? null } : null

  return { entries, created: toMarker(firstSeen), deleted: toMarker(firstUnseen) }
}

export type RecordStateResult =
  | { ok: true; fields: Record<string, unknown> }
  | { error: 'record_not_found' | 'run_not_found' }

/**
 * The record's field values as they stood at `asOfRun` (later updates undone),
 * JSON-decoded. `record_not_found` when the record is absent; `run_not_found`
 * when `asOfRun` is not a real run in this Space.
 */
export async function fetchRecordStateAsOf(
  tx: SpaceTx,
  recordId: string,
  asOfRun: string,
): Promise<RecordStateResult> {
  const recRows = (await tx.execute(recordMarkersQuery(recordId))) as unknown as Iterable<{
    record_id: string
  }>
  if (![...recRows][0]) return { error: 'record_not_found' }

  const updateRows = [
    ...((await tx.execute(recordUpdatesQuery(recordId))) as unknown as Iterable<{
      field_id: string
      run_id: string
      old_value: string | null
    }>),
  ]
  const currentRows = [
    ...((await tx.execute(currentFieldDataQuery(recordId))) as unknown as Iterable<{
      field_id: string
      value: string | null
    }>),
  ]

  const runIds = new Set<string>([asOfRun])
  for (const u of updateRows) if (u.run_id) runIds.add(u.run_id)
  const runRows = [
    ...((await tx.execute(baseRunsByIdsQuery([...runIds]))) as unknown as Iterable<{
      id: string
      started_at: unknown
      completed_at: unknown
    }>),
  ]
  if (!runRows.some((r) => r.id === asOfRun)) return { error: 'run_not_found' }

  const seqInput: RunTimeRow[] = runRows.map((r) => ({
    runId: r.id,
    startedAt: tsIso(r.started_at),
    completedAt: tsIso(r.completed_at),
  }))
  for (const id of runIds) {
    if (!seqInput.some((s) => s.runId === id)) seqInput.push({ runId: id, startedAt: null, completedAt: null })
  }
  const seqMap = assignRunSeq(seqInput)

  const updates: RecordUpdate[] = updateRows.map((u) => ({
    fieldId: u.field_id,
    runId: u.run_id,
    runSeq: seqMap.get(u.run_id) ?? 0,
    oldValue: u.old_value,
  }))
  const current: FieldValue[] = currentRows.map((c) => ({ fieldId: c.field_id, value: c.value }))

  const stateMap = recordStateAsOf(current, updates, seqMap.get(asOfRun) ?? 0)
  const fields: Record<string, unknown> = {}
  for (const [fieldId, v] of stateMap) fields[fieldId] = decodeValue(v)
  return { ok: true, fields }
}

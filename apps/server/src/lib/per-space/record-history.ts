// Pure record-history reconstruction for the /data browser (server-data-browse
// Task 1.2). No I/O. `bo_at_record_updates` stores the OLD value replaced at each
// run; the current value lives in `bo_at_record_field_data`. Replaying the
// updates backwards from the current state yields per-run before→after diffs;
// `first_seen_run` / `first_unseen_run` mark creation and deletion (which log no
// field-value rows). Unit-tested with created→updated→cleared→deleted sequences.

export interface FieldValue {
  fieldId: string
  value: string | null // JSON-encoded, as stored
}

export interface RecordUpdate {
  fieldId: string
  runId: string
  runSeq: number // run ordering (asc = older); from bo_at_base_runs
  oldValue: string | null
}

export interface RunMarker {
  runId: string
  seq: number
}

export interface HistoryChange {
  fieldId: string
  before: string | null
  after: string | null
}

export interface HistoryEntry {
  runId: string
  seq: number
  changes: HistoryChange[]
  marker?: 'created' | 'deleted'
}

/**
 * Reconstruct a record's timeline, newest run first. Each entry is the set of
 * field changes at that run; the created/deleted runs appear even though they
 * carry no field-update rows.
 */
export function buildRecordHistory(input: {
  current: FieldValue[]
  updates: RecordUpdate[]
  firstSeen: RunMarker | null
  firstUnseen: RunMarker | null
}): HistoryEntry[] {
  const running = new Map<string, string | null>(input.current.map((c) => [c.fieldId, c.value]))

  // Group updates by run, remembering each run's seq.
  const byRun = new Map<string, { seq: number; updates: RecordUpdate[] }>()
  for (const u of input.updates) {
    const g = byRun.get(u.runId) ?? { seq: u.runSeq, updates: [] }
    g.updates.push(u)
    byRun.set(u.runId, g)
  }

  // Ensure the created/deleted runs have an entry even with no field updates.
  const seqOf = new Map<string, number>()
  for (const [runId, g] of byRun) seqOf.set(runId, g.seq)
  if (input.firstSeen) seqOf.set(input.firstSeen.runId, input.firstSeen.seq)
  if (input.firstUnseen) seqOf.set(input.firstUnseen.runId, input.firstUnseen.seq)

  // Walk runs newest→oldest so the backward replay is correct.
  const runIdsDesc = [...seqOf.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)

  const entries: HistoryEntry[] = []
  for (const runId of runIdsDesc) {
    const g = byRun.get(runId)
    const changes: HistoryChange[] = []
    if (g) {
      for (const u of g.updates) {
        const after = running.get(u.fieldId) ?? null // value this field had after the run
        changes.push({ fieldId: u.fieldId, before: u.oldValue, after })
        running.set(u.fieldId, u.oldValue) // step backward past this run
      }
    }
    const entry: HistoryEntry = { runId, seq: seqOf.get(runId)!, changes }
    if (input.firstUnseen?.runId === runId) entry.marker = 'deleted'
    else if (input.firstSeen?.runId === runId) entry.marker = 'created'
    entries.push(entry)
  }
  return entries
}

/**
 * Field values as of a given run: current values with every later update undone.
 * Walk updates newest→oldest, applying each update with `runSeq > asOfSeq` (the
 * oldest such update per field lands the value that was current at `asOfSeq`).
 */
export function recordStateAsOf(
  current: FieldValue[],
  updates: RecordUpdate[],
  asOfSeq: number,
): Map<string, string | null> {
  const running = new Map<string, string | null>(current.map((c) => [c.fieldId, c.value]))
  const later = updates.filter((u) => u.runSeq > asOfSeq).sort((a, b) => b.runSeq - a.runSeq)
  for (const u of later) running.set(u.fieldId, u.oldValue)
  return running
}

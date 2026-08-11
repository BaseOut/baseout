import { describe, it, expect } from 'vitest'
import {
  buildRecordHistory,
  recordStateAsOf,
  type FieldValue,
  type RecordUpdate,
} from '../../../src/lib/per-space/record-history'

// A record's life: created @run1 (name="A"), name→"B" @run2, name cleared @run3,
// deleted @run4. record_updates stores the OLD value replaced at each run.
const current: FieldValue[] = [{ fieldId: 'name', value: null }] // cleared, still current
const updates: RecordUpdate[] = [
  { fieldId: 'name', runId: 'r2', runSeq: 2, oldValue: '"A"' }, // at r2, A → B
  { fieldId: 'name', runId: 'r3', runSeq: 3, oldValue: '"B"' }, // at r3, B → (null)
]
const firstSeen = { runId: 'r1', seq: 1 }
const firstUnseen = { runId: 'r4', seq: 4 }

describe('buildRecordHistory', () => {
  it('reconstructs per-run before→after diffs, newest run first', () => {
    const entries = buildRecordHistory({ current, updates, firstSeen, firstUnseen })
    expect(entries.map((e) => e.runId)).toEqual(['r4', 'r3', 'r2', 'r1']) // desc

    const r3 = entries.find((e) => e.runId === 'r3')!
    expect(r3.changes).toEqual([{ fieldId: 'name', before: '"B"', after: null }]) // cleared
    const r2 = entries.find((e) => e.runId === 'r2')!
    expect(r2.changes).toEqual([{ fieldId: 'name', before: '"A"', after: '"B"' }]) // A→B
  })

  it('marks the created and deleted runs (which log no field changes)', () => {
    const entries = buildRecordHistory({ current, updates, firstSeen, firstUnseen })
    expect(entries.find((e) => e.runId === 'r1')!.marker).toBe('created')
    expect(entries.find((e) => e.runId === 'r1')!.changes).toEqual([])
    expect(entries.find((e) => e.runId === 'r4')!.marker).toBe('deleted')
  })

  it('handles a still-live record (no first_unseen) and multiple fields', () => {
    const entries = buildRecordHistory({
      current: [{ fieldId: 'a', value: '"2"' }, { fieldId: 'b', value: '"y"' }],
      updates: [{ fieldId: 'a', runId: 'r2', runSeq: 2, oldValue: '"1"' }],
      firstSeen: { runId: 'r1', seq: 1 },
      firstUnseen: null,
    })
    expect(entries.some((e) => e.marker === 'deleted')).toBe(false)
    expect(entries.find((e) => e.runId === 'r2')!.changes).toEqual([{ fieldId: 'a', before: '"1"', after: '"2"' }])
  })
})

describe('recordStateAsOf', () => {
  it('returns field values as of a given run (undoing later updates)', () => {
    // As of r2: name should be "B" (r3 clear undone).
    const asOfR2 = recordStateAsOf(current, updates, 2)
    expect(asOfR2.get('name')).toBe('"B"')
    // As of r1: name should be "A" (r2 and r3 undone).
    const asOfR1 = recordStateAsOf(current, updates, 1)
    expect(asOfR1.get('name')).toBe('"A"')
    // As of r3 (newest update): equals current (null).
    expect(recordStateAsOf(current, updates, 3).get('name')).toBeNull()
  })
})

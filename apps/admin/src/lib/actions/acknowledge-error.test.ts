import { describe, expect, it, vi } from 'vitest'
import { handleAckPost, validateAckBody, type AckRowInsert, type HandleAckDeps } from './acknowledge-error'
import type { AuditRow } from '../audit'

const ORIGIN = 'https://admin.baseout.local'
const actor = { id: 'u1', email: 'staff@openside.com' }

function deps(over: { recent?: number } = {}): HandleAckDeps & { auditRows: AuditRow[]; acks: AckRowInsert[] } {
  const auditRows: AuditRow[] = []
  const acks: AckRowInsert[] = []
  return {
    auditRows,
    acks,
    audit: {
      insertAuditRow: vi.fn(async (row) => { auditRows.push(row); return `audit_${auditRows.length}` }),
      countRecentIntentsByActor: vi.fn(async () => over.recent ?? 0),
    },
    insertAck: vi.fn(async (row) => { acks.push(row) }),
  }
}

const input = (body: unknown, origin: string | null = ORIGIN) => ({ origin, selfOrigin: ORIGIN, body, actor })

describe('validateAckBody', () => {
  it('rejects unknown target types (400 invalid_target_type)', () => {
    expect(validateAckBody({ targetType: 'nope', targetId: 'x' })).toEqual({ ok: false, error: 'invalid_target_type' })
  })
  it('rejects a missing/empty targetId', () => {
    expect(validateAckBody({ targetType: 'backup_run' }).ok).toBe(false)
  })
  it('accepts a valid body with optional note/state', () => {
    const r = validateAckBody({ targetType: 'connection', targetId: 'c1', targetState: 'invalid', note: 'looking into it' })
    expect(r.ok).toBe(true)
  })
})

describe('handleAckPost', () => {
  it('happy path: writes intent+result audit rows AND one ack row; 200', async () => {
    const d = deps()
    const res = await handleAckPost('ack', input({ targetType: 'backup_run', targetId: 'r1', organizationId: 'o1' }), d)
    expect(res.status).toBe(200)
    expect(d.auditRows.map((r) => r.phase)).toEqual(['intent', 'result'])
    expect(d.auditRows[0].action).toBe('acknowledge_error')
    expect(d.acks).toHaveLength(1)
    expect(d.acks[0]).toMatchObject({ phase: 'ack', targetType: 'backup_run', targetId: 'r1', ackedByEmail: 'staff@openside.com' })
  })

  it('un-ack route writes phase=unack + action=unacknowledge_error', async () => {
    const d = deps()
    await handleAckPost('unack', input({ targetType: 'connection', targetId: 'c1', targetState: 'invalid' }), d)
    expect(d.acks[0].phase).toBe('unack')
    expect(d.auditRows[0].action).toBe('unacknowledge_error')
    expect(d.acks[0].targetState).toBe('invalid')
  })

  it('excludes the note body from the audit params (hasNote only)', async () => {
    const d = deps()
    await handleAckPost('ack', input({ targetType: 'backup_run', targetId: 'r1', note: 'secret free text' }), d)
    expect(d.auditRows[0].params).toEqual({ targetType: 'backup_run', targetId: 'r1', hasNote: true })
    expect(JSON.stringify(d.auditRows)).not.toContain('secret free text')
    expect(d.acks[0].note).toBe('secret free text') // note lives only in the ack row
  })

  it('cross-origin → 403 with NO writes', async () => {
    const d = deps()
    const res = await handleAckPost('ack', input({ targetType: 'backup_run', targetId: 'r1' }, 'https://evil.example'), d)
    expect(res.status).toBe(403)
    expect(d.auditRows).toHaveLength(0)
    expect(d.acks).toHaveLength(0)
  })

  it('over the rate limit → 429 with no ack row', async () => {
    const d = deps({ recent: 99 })
    const res = await handleAckPost('ack', input({ targetType: 'backup_run', targetId: 'r1' }), d)
    expect(res.status).toBe(429)
    expect(d.acks).toHaveLength(0)
  })

  it('unknown target type → 400 with no writes', async () => {
    const d = deps()
    const res = await handleAckPost('ack', input({ targetType: 'bogus', targetId: 'r1' }), d)
    expect(res.status).toBe(400)
    expect(d.auditRows).toHaveLength(0)
  })
})

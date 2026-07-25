import { describe, expect, it } from 'vitest'
import {
  classifyErrors,
  connectionFingerprint,
  countOpenErrors,
  groupByOrg,
  type AckRow,
  type ErrorSources,
} from './errors'

const D = (iso: string) => new Date(iso)
const empty: ErrorSources = { backupRuns: [], backupRunBases: [], restoreRuns: [], connections: [], spaceDatabases: [] }

describe('connectionFingerprint', () => {
  it('is the status for invalid / pending_reauth, else a hash of the refresh error', () => {
    expect(connectionFingerprint({ status: 'invalid', oauthRefreshLastError: null })).toBe('invalid')
    expect(connectionFingerprint({ status: 'pending_reauth', oauthRefreshLastError: null })).toBe('pending_reauth')
    const a = connectionFingerprint({ status: 'active', oauthRefreshLastError: 'AADSTS50173' })
    const b = connectionFingerprint({ status: 'active', oauthRefreshLastError: 'different error' })
    expect(a).toMatch(/^err:/)
    expect(a).not.toBe(b) // different error text → different fingerprint
  })
})

describe('classifyErrors', () => {
  it('normalizes each source with the right occurrence time + message', () => {
    const items = classifyErrors(
      {
        ...empty,
        backupRuns: [{ id: 'r1', spaceId: 's1', spaceName: 'Prod', orgId: 'o1', orgName: 'Acme', errorMessage: 'boom', completedAt: D('2026-07-01'), createdAt: D('2026-06-30') }],
        backupRunBases: [{ id: 'rb1', spaceId: 's1', spaceName: 'Prod', orgId: 'o1', orgName: 'Acme', baseName: 'Contacts', errorMessage: null, completedAt: null, runCreatedAt: D('2026-06-29') }],
        connections: [{ id: 'c1', orgId: 'o1', orgName: 'Acme', status: 'invalid', oauthRefreshLastError: null, invalidatedAt: D('2026-07-02'), pendingReauthAt: null, modifiedAt: D('2026-01-01') }],
      },
      [],
    )
    const run = items.find((i) => i.type === 'backup_run')!
    expect(run.occurredAt).toEqual(D('2026-07-01')) // completedAt preferred
    const base = items.find((i) => i.type === 'backup_run_base')!
    expect(base.occurredAt).toEqual(D('2026-06-29')) // completedAt null → runCreatedAt
    expect(base.message).toBe('Base backup failed.') // null errorMessage → default
    const conn = items.find((i) => i.type === 'connection')!
    expect(conn.occurredAt).toEqual(D('2026-07-02')) // invalidatedAt
    expect(conn.stateFingerprint).toBe('invalid')
    // newest first
    expect(items[0].occurredAt.getTime()).toBeGreaterThanOrEqual(items[items.length - 1].occurredAt.getTime())
  })

  it('acks resolve to the latest phase; unack after ack re-opens', () => {
    const sources: ErrorSources = { ...empty, backupRuns: [{ id: 'r1', spaceId: 's1', spaceName: 'P', orgId: 'o1', orgName: 'A', errorMessage: 'x', completedAt: D('2026-07-01'), createdAt: D('2026-07-01') }] }
    const acks: AckRow[] = [
      { targetType: 'backup_run', targetId: 'r1', targetState: null, phase: 'ack', createdAt: D('2026-07-02'), ackedByEmail: 'staff@x.com' },
      { targetType: 'backup_run', targetId: 'r1', targetState: null, phase: 'unack', createdAt: D('2026-07-03'), ackedByEmail: 'staff@x.com' },
    ]
    expect(classifyErrors(sources, acks)[0].acked).toBe(false) // latest is unack
    expect(classifyErrors(sources, acks.slice(0, 1))[0].acked).toBe(true) // only the ack
  })

  it('a connection ack only suppresses while the fingerprint matches', () => {
    const conn = { id: 'c1', orgId: 'o1', orgName: 'A', oauthRefreshLastError: null, invalidatedAt: D('2026-07-01'), pendingReauthAt: null, modifiedAt: null }
    const ackInvalid: AckRow = { targetType: 'connection', targetId: 'c1', targetState: 'invalid', phase: 'ack', createdAt: D('2026-07-02'), ackedByEmail: 's@x.com' }
    // same fingerprint → acked
    expect(classifyErrors({ ...empty, connections: [{ ...conn, status: 'invalid' }] }, [ackInvalid])[0].acked).toBe(true)
    // connection now broken differently (pending_reauth) → the invalid-ack no longer matches → open
    expect(classifyErrors({ ...empty, connections: [{ ...conn, status: 'pending_reauth' }] }, [ackInvalid])[0].acked).toBe(false)
  })
})

describe('groupByOrg + countOpenErrors', () => {
  const sources: ErrorSources = {
    ...empty,
    backupRuns: [
      { id: 'r1', spaceId: 's1', spaceName: 'P', orgId: 'o1', orgName: 'Acme', errorMessage: 'x', completedAt: D('2026-07-05'), createdAt: D('2026-07-05') },
      { id: 'r2', spaceId: 's2', spaceName: 'Q', orgId: 'o2', orgName: 'Beta', errorMessage: 'y', completedAt: D('2026-07-06'), createdAt: D('2026-07-06') },
    ],
    connections: [{ id: 'c1', orgId: 'o1', orgName: 'Acme', status: 'invalid', oauthRefreshLastError: null, invalidatedAt: D('2026-07-04'), pendingReauthAt: null, modifiedAt: null }],
  }

  it('groups by org, newest-first within and across groups', () => {
    const groups = groupByOrg(classifyErrors(sources, []))
    expect(groups.map((g) => g.orgId)).toEqual(['o2', 'o1']) // Beta's newest (07-06) > Acme's newest (07-05)
    expect(groups.find((g) => g.orgId === 'o1')!.items.map((i) => i.targetId)).toEqual(['r1', 'c1']) // 07-05 before 07-04
  })

  it('countOpenErrors ignores acked items', () => {
    const acks: AckRow[] = [{ targetType: 'backup_run', targetId: 'r1', targetState: null, phase: 'ack', createdAt: D('2026-07-10'), ackedByEmail: 's@x.com' }]
    const counts = countOpenErrors(classifyErrors(sources, acks))
    expect(counts.total).toBe(2) // r2 + c1 open; r1 acked
    expect(counts.byType.backup_run).toBe(1)
    expect(counts.byType.connection).toBe(1)
  })
})

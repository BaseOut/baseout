import { describe, expect, it, vi } from 'vitest'
import { runAudited, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, type AuditDeps, type AuditIntent } from './audit'

const intent: AuditIntent = {
  actor: { id: 'user-1', email: 'staff@openside.com' },
  action: 'force_migration',
  targetType: 'organization',
  targetId: 'org-1',
  organizationId: 'org-1',
  params: { orgSlug: 'acme' },
}

function makeDeps(overrides: Partial<AuditDeps> = {}): AuditDeps {
  return {
    insertAuditRow: vi.fn(async () => 'row-id'),
    countRecentIntentsByActor: vi.fn(async () => 0),
    ...overrides,
  }
}

describe('runAudited', () => {
  it('writes intent, executes, then writes result on success', async () => {
    const deps = makeDeps()
    const execute = vi.fn(async () => ({ ok: true as const, runId: 'run-1' }))

    const result = await runAudited(intent, execute, deps)

    expect(result).toEqual({ ok: true, value: { ok: true, runId: 'run-1' }, intentId: 'row-id' })
    expect(deps.insertAuditRow).toHaveBeenCalledTimes(2)
    const [first, second] = vi.mocked(deps.insertAuditRow).mock.calls
    expect(first[0]).toMatchObject({
      phase: 'intent',
      actorUserId: 'user-1',
      actorEmail: 'staff@openside.com',
      action: 'force_migration',
      targetType: 'organization',
      targetId: 'org-1',
      params: { orgSlug: 'acme' },
    })
    expect(second[0]).toMatchObject({
      phase: 'result',
      intentId: 'row-id',
      action: 'force_migration',
      params: { ok: true, runId: 'run-1' },
    })
    // intent row is written before execute runs
    expect(vi.mocked(deps.insertAuditRow).mock.invocationCallOrder[0])
      .toBeLessThan(execute.mock.invocationCallOrder[0])
  })

  it('rate-limits at RATE_LIMIT_MAX intents per window without writing anything', async () => {
    const deps = makeDeps({ countRecentIntentsByActor: vi.fn(async () => RATE_LIMIT_MAX) })
    const execute = vi.fn()

    const result = await runAudited(intent, execute, deps)

    expect(result).toEqual({ ok: false, code: 'rate_limited' })
    expect(deps.insertAuditRow).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
    expect(deps.countRecentIntentsByActor).toHaveBeenCalledWith('user-1', RATE_LIMIT_WINDOW_MS)
  })

  it('does not execute when the intent insert fails', async () => {
    const deps = makeDeps({ insertAuditRow: vi.fn(async () => { throw new Error('db down') }) })
    const execute = vi.fn()

    const result = await runAudited(intent, execute, deps)

    expect(result).toEqual({ ok: false, code: 'audit_write_failed' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('swallows a result-row insert failure (intent + domain state already recorded)', async () => {
    const insertAuditRow = vi.fn(async (row: { phase: string }) => {
      if (row.phase === 'result') throw new Error('db hiccup')
      return 'row-id'
    })
    const deps = makeDeps({ insertAuditRow })
    const execute = vi.fn(async () => ({ ok: true as const }))

    const result = await runAudited(intent, execute, deps)

    expect(result).toEqual({ ok: true, value: { ok: true }, intentId: 'row-id' })
  })

  it('records an exception result row and reports failure when execute throws', async () => {
    const deps = makeDeps()
    const execute = vi.fn(async () => { throw new Error('boom') })

    const result = await runAudited(intent, execute, deps)

    expect(result).toEqual({ ok: false, code: 'exception', intentId: 'row-id' })
    const resultRow = vi.mocked(deps.insertAuditRow).mock.calls[1][0]
    expect(resultRow).toMatchObject({
      phase: 'result',
      intentId: 'row-id',
      params: { ok: false, code: 'exception' },
    })
  })

  it('passes a failed execute result through and records it in the result row', async () => {
    const deps = makeDeps()
    const execute = vi.fn(async () => ({ ok: false as const, code: 'no_bases_selected' }))

    const result = await runAudited(intent, execute, deps)

    expect(result).toEqual({
      ok: true,
      value: { ok: false, code: 'no_bases_selected' },
      intentId: 'row-id',
    })
    const resultRow = vi.mocked(deps.insertAuditRow).mock.calls[1][0]
    expect(resultRow.params).toMatchObject({ ok: false, code: 'no_bases_selected' })
  })
})

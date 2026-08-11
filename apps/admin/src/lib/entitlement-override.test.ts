import { describe, expect, it, vi } from 'vitest'
import { applyOverrideWrite, type OverrideFeatureDef, type OverrideUpsert } from '@baseout/db-schema'
import { runAudited, type AuditDeps, type AuditIntent } from './audit'

// Proves the override write path composes with the standard audited-mutation
// door: runAudited(intent, () => applyOverrideWrite(...), deps) writes an intent
// row BEFORE the upsert and a result row after — so no override lands without an
// audit trail. The domain write itself is unit-tested in @baseout/db-schema.

function makeAuditDeps(overrides: Partial<AuditDeps> = {}): AuditDeps {
  return {
    insertAuditRow: vi.fn(async () => 'row-id'),
    countRecentIntentsByActor: vi.fn(async () => 0),
    ...overrides,
  }
}

function makeOverrideDeps(feature: OverrideFeatureDef | null) {
  const upsert = vi.fn(async (_row: OverrideUpsert) => {})
  return { deps: { getFeature: async () => feature, upsertOverride: upsert }, upsert }
}

const intent = (params: Record<string, unknown>): AuditIntent => ({
  actor: { id: 'user-staff', email: 'staff@openside.com' },
  action: 'set_entitlement_override',
  targetType: 'organization',
  targetId: 'org-1',
  organizationId: 'org-1',
  params,
})

describe('audited override write', () => {
  it('logs intent, upserts the override, then logs the result', async () => {
    const auditDeps = makeAuditDeps()
    const { deps, upsert } = makeOverrideDeps({ valueType: 'limit' })

    const result = await runAudited(
      intent({ featureSlug: 'spaces', reason: 'contract #42' }),
      () =>
        applyOverrideWrite(deps, {
          organizationId: 'org-1', featureSlug: 'spaces',
          value: { type: 'limit', limit: 25 }, reason: 'contract #42', grantedByUserId: 'user-staff',
        }),
      auditDeps,
    )

    expect(result.ok).toBe(true)
    expect(auditDeps.insertAuditRow).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(vi.mocked(upsert).mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1', featureSlug: 'spaces',
      columns: { valueNumeric: 25 }, reason: 'contract #42',
    })
    // intent row precedes the mutation
    expect(vi.mocked(auditDeps.insertAuditRow).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(upsert).mock.invocationCallOrder[0])
    const [intentRow, resultRow] = vi.mocked(auditDeps.insertAuditRow).mock.calls
    expect(intentRow[0]).toMatchObject({ phase: 'intent', action: 'set_entitlement_override' })
    expect(resultRow[0]).toMatchObject({ phase: 'result', params: { ok: true } })
  })

  it('audits a rejected write and performs no upsert', async () => {
    const auditDeps = makeAuditDeps()
    const { deps, upsert } = makeOverrideDeps({ valueType: 'enum', enumValues: ['monthly', 'weekly'] })

    const result = await runAudited(
      intent({ featureSlug: 'backup_frequency_max', reason: 'x' }),
      () =>
        applyOverrideWrite(deps, {
          organizationId: 'org-1', featureSlug: 'backup_frequency_max',
          value: { type: 'enum', enum: 'hourly' }, reason: 'x',
        }),
      auditDeps,
    )

    expect(result.ok).toBe(true) // runAudited succeeded; the domain result is the failure
    if (result.ok) expect(result.value).toMatchObject({ ok: false, code: 'invalid_value' })
    expect(upsert).not.toHaveBeenCalled()
    // Both intent and result rows still written — the attempt is on the record.
    expect(auditDeps.insertAuditRow).toHaveBeenCalledTimes(2)
    expect(vi.mocked(auditDeps.insertAuditRow).mock.calls[1][0]).toMatchObject({
      phase: 'result', params: { ok: false, code: 'invalid_value' },
    })
  })
})

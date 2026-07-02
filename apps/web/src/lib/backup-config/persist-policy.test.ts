/**
 * Pure-function tests for the backup-config policy upsert helper.
 *
 * The route owns the Drizzle UPSERT (`upsertConfig` dep). This helper
 * validates the body shape against the tier capability + Features §6.6
 * MVP storage rule, and dispatches the upsert when valid. The test
 * pattern mirrors src/lib/backup-runs/start.test.ts: vi.fn() deps so
 * paths are unit-testable without touching Postgres.
 */

import { describe, expect, it, vi } from 'vitest'
import { persistBackupConfigPolicy } from './persist-policy'
import type { PersistBackupConfigPolicyDeps } from './persist-policy'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function deps(
  overrides: Partial<PersistBackupConfigPolicyDeps> = {},
): PersistBackupConfigPolicyDeps & {
  upsertConfig: ReturnType<typeof vi.fn>
} {
  return {
    upsertConfig: vi.fn(async () => {}),
    ...overrides,
  } as PersistBackupConfigPolicyDeps & {
    upsertConfig: ReturnType<typeof vi.fn>
  }
}

describe('persistBackupConfigPolicy', () => {
  it('rejects frequency above the tier with frequency_not_allowed', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { frequency: 'daily' }, tier: 'starter' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'frequency_not_allowed' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('rejects unsupported storageType with unsupported_storage_type', async () => {
    // 's3' is the next BYOS provider on the roadmap and is intentionally
    // NOT yet in ALLOWED_STORAGE_TYPES — it stands in as the canonical
    // unsupported example. (Earlier stand-ins 'dropbox' then 'onedrive' each
    // moved into the allow list as their provider commit chains landed.)
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { storageType: 's3' }, tier: 'pro' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'unsupported_storage_type' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('rejects unknown fields with invalid_request', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { frequency: 'monthly', extra: 'nope' },
        tier: 'pro',
      },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('rejects non-string frequency value with invalid_request', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { frequency: 42 }, tier: 'pro' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
  })

  it('rejects an unrecognized frequency literal with invalid_request', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { frequency: 'hourly' }, tier: 'enterprise' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
  })

  it('upserts both fields when both are present and valid', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { frequency: 'daily', storageType: 'r2_managed' },
        tier: 'pro',
      },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledOnce()
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      frequency: 'daily',
      storageType: 'r2_managed',
    })
  })

  it('upserts only frequency when storageType is absent', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { frequency: 'weekly' }, tier: 'launch' },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      frequency: 'weekly',
    })
  })

  it('upserts only storageType when frequency is absent', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { storageType: 'r2_managed' }, tier: 'starter' },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      storageType: 'r2_managed',
    })
  })

  it('accepts google_drive (shared-byos-drive)', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { storageType: 'google_drive' },
        tier: 'starter',
      },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      storageType: 'google_drive',
    })
  })

  it('accepts local_fs (explicit dev-only writer)', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { storageType: 'local_fs' },
        tier: 'starter',
      },
      d,
    )
    expect(result).toEqual({ ok: true })
  })

  it('returns invalid_request when neither field is present (no-op rejected)', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: {}, tier: 'starter' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('treats a null tier as starter (most-restrictive fallback)', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { frequency: 'weekly' }, tier: null },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'frequency_not_allowed' })
  })

  // workspace-rediscovery: autoAddFutureBases coverage
  it('accepts autoAddFutureBases=true alone and forwards it to the upsert', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { autoAddFutureBases: true },
        tier: 'starter',
      },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      autoAddFutureBases: true,
    })
  })

  it('accepts autoAddFutureBases=false alone and forwards it to the upsert', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { autoAddFutureBases: false },
        tier: 'pro',
      },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      autoAddFutureBases: false,
    })
  })

  it('rejects autoAddFutureBases when not a boolean', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { autoAddFutureBases: 'yes' },
        tier: 'pro',
      },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('does not tier-gate autoAddFutureBases (tier-cap applies at rediscovery time)', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { autoAddFutureBases: true },
        tier: null,
      },
      d,
    )
    expect(result).toEqual({ ok: true })
  })

  // server-backup-scope: scope + schema schedule
  it('upserts scope + dual cadence (schema_and_data, data + schema)', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      {
        spaceId: SPACE_ID,
        body: { scope: 'schema_and_data', frequency: 'monthly', schemaFrequency: 'daily' },
        tier: 'pro',
      },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      scope: 'schema_and_data',
      frequency: 'monthly',
      schemaFrequency: 'daily',
    })
  })

  it('upserts scope=schema_only with a schema cadence', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { scope: 'schema_only', schemaFrequency: 'weekly' }, tier: 'launch' },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      scope: 'schema_only',
      schemaFrequency: 'weekly',
    })
  })

  it('accepts schemaFrequency=null to clear the schema schedule', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { schemaFrequency: null }, tier: 'pro' },
      d,
    )
    expect(result).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({ spaceId: SPACE_ID, schemaFrequency: null })
  })

  it('rejects an unknown scope with invalid_request', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { scope: 'everything' }, tier: 'pro' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('tier-gates schemaFrequency like the data cadence', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { scope: 'schema_only', schemaFrequency: 'daily' }, tier: 'starter' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'frequency_not_allowed' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('rejects an unrecognized schemaFrequency literal with invalid_request', async () => {
    const d = deps()
    const result = await persistBackupConfigPolicy(
      { spaceId: SPACE_ID, body: { schemaFrequency: 'hourly' }, tier: 'enterprise' },
      d,
    )
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
  })
})

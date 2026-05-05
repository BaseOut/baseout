import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  backupConfigurationBases,
  backupConfigurations,
} from '../../src/db/schema'
import { persistBaseSelection } from '../../src/lib/backup-config/persist'
import {
  db,
  resetBaseoutTables,
  seedAtBase,
  seedOrgWithMembership,
  seedUser,
} from './setup/testHarness'

describe('persistBaseSelection (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('creates a backup_configurations row and enables selected bases on first call', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)
    const { atBaseRowId: a } = await seedAtBase(spaceId, { atBaseId: 'appA', name: 'A' })
    const { atBaseRowId: b } = await seedAtBase(spaceId, { atBaseId: 'appB', name: 'B' })

    const result = await persistBaseSelection(db, {
      spaceId,
      toEnable: [a, b],
      toDisable: [],
    })

    expect(result.backupConfigurationId).toBeTruthy()

    const configRows = await db
      .select()
      .from(backupConfigurations)
      .where(eq(backupConfigurations.spaceId, spaceId))
    expect(configRows).toHaveLength(1)
    expect(configRows[0].frequency).toBe('monthly')
    expect(configRows[0].mode).toBe('static')
    expect(configRows[0].storageType).toBe('r2_managed')

    const baseRows = await db
      .select({ atBaseId: backupConfigurationBases.atBaseId, isIncluded: backupConfigurationBases.isIncluded })
      .from(backupConfigurationBases)
      .where(eq(backupConfigurationBases.backupConfigurationId, result.backupConfigurationId))
      .orderBy(backupConfigurationBases.atBaseId)
    expect(baseRows).toEqual([
      { atBaseId: a, isIncluded: true },
      { atBaseId: b, isIncluded: true },
    ])
  })

  it('reuses the existing backup_configurations row on subsequent calls', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)
    const { atBaseRowId: a } = await seedAtBase(spaceId, { atBaseId: 'appA', name: 'A' })
    const { atBaseRowId: b } = await seedAtBase(spaceId, { atBaseId: 'appB', name: 'B' })

    const first = await persistBaseSelection(db, { spaceId, toEnable: [a], toDisable: [] })
    const second = await persistBaseSelection(db, { spaceId, toEnable: [b], toDisable: [a] })

    expect(second.backupConfigurationId).toBe(first.backupConfigurationId)

    const baseRows = await db
      .select({ atBaseId: backupConfigurationBases.atBaseId, isIncluded: backupConfigurationBases.isIncluded })
      .from(backupConfigurationBases)
      .where(eq(backupConfigurationBases.backupConfigurationId, first.backupConfigurationId))
      .orderBy(backupConfigurationBases.atBaseId)
    expect(baseRows).toEqual([
      { atBaseId: a, isIncluded: false },
      { atBaseId: b, isIncluded: true },
    ])
  })

  it('is a no-op when toEnable and toDisable are empty', async () => {
    const { userId } = await seedUser()
    const { spaceId } = await seedOrgWithMembership(userId)

    const result = await persistBaseSelection(db, { spaceId, toEnable: [], toDisable: [] })

    const configRows = await db
      .select()
      .from(backupConfigurations)
      .where(eq(backupConfigurations.spaceId, spaceId))
    expect(configRows).toHaveLength(1)
    expect(result.backupConfigurationId).toBe(configRows[0].id)
  })
})

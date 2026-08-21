import { describe, expect, it, vi } from 'vitest'
import { ensureInternalSpaceReady } from './internal-space-ready'
import type { EnsureInternalSpaceReadyDeps } from './internal-space-ready'

const baseDeps = (): EnsureInternalSpaceReadyDeps & {
  resolveInternal: ReturnType<typeof vi.fn>
  setDynamicMode: ReturnType<typeof vi.fn>
  fetchSpaceDatabase: ReturnType<typeof vi.fn>
  enableRecords: ReturnType<typeof vi.fn>
  provisionDatabase: ReturnType<typeof vi.fn>
  armSchedule: ReturnType<typeof vi.fn>
  kickBackupIfIdle: ReturnType<typeof vi.fn>
} => ({
  resolveInternal: vi.fn(async () => true),
  setDynamicMode: vi.fn(async () => {}),
  fetchSpaceDatabase: vi.fn(async () => null),
  enableRecords: vi.fn(async () => {}),
  provisionDatabase: vi.fn(async () => {}),
  armSchedule: vi.fn(async () => {}),
  kickBackupIfIdle: vi.fn(async () => {}),
})

describe('ensureInternalSpaceReady', () => {
  it('does nothing for non-internal orgs', async () => {
    const deps = baseDeps()
    deps.resolveInternal.mockResolvedValue(false)

    await ensureInternalSpaceReady({ organizationId: 'org_1', spaceId: 'space_1' }, deps)

    expect(deps.setDynamicMode).not.toHaveBeenCalled()
    expect(deps.provisionDatabase).not.toHaveBeenCalled()
  })

  it('sets internal Spaces to dynamic mode', async () => {
    const deps = baseDeps()
    deps.fetchSpaceDatabase.mockResolvedValue({
      status: 'active',
      backend: 'managed_pg',
      recordsEnabled: true,
    })

    await ensureInternalSpaceReady({ organizationId: 'org_1', spaceId: 'space_1' }, deps)

    expect(deps.setDynamicMode).toHaveBeenCalledWith('space_1')
    expect(deps.armSchedule).toHaveBeenCalledWith('space_1')
    expect(deps.kickBackupIfIdle).toHaveBeenCalledWith({
      organizationId: 'org_1',
      spaceId: 'space_1',
    })
    expect(deps.enableRecords).not.toHaveBeenCalled()
    expect(deps.provisionDatabase).not.toHaveBeenCalled()
  })

  it('does not kick a backup when the caller is already starting one', async () => {
    const deps = baseDeps()
    deps.fetchSpaceDatabase.mockResolvedValue({
      status: 'active',
      backend: 'managed_pg',
      recordsEnabled: true,
    })

    await ensureInternalSpaceReady(
      { organizationId: 'org_1', spaceId: 'space_1', kickBackupIfIdle: false },
      deps,
    )

    expect(deps.armSchedule).toHaveBeenCalledWith('space_1')
    expect(deps.kickBackupIfIdle).not.toHaveBeenCalled()
  })

  it('still arms the schedule when dynamic database provisioning is missing', async () => {
    const deps = baseDeps()

    await ensureInternalSpaceReady(
      { organizationId: 'org_1', spaceId: 'space_1', userId: 'user_1' },
      deps,
    )

    expect(deps.armSchedule).toHaveBeenCalledWith('space_1')
  })

  it('provisions managed_pg with records enabled when missing', async () => {
    const deps = baseDeps()

    await ensureInternalSpaceReady(
      { organizationId: 'org_1', spaceId: 'space_1', userId: 'user_1' },
      deps,
    )

    expect(deps.provisionDatabase).toHaveBeenCalledWith('space_1', {
      backend: 'managed_pg',
      recordsEnabled: true,
      provisionedByUserId: 'user_1',
    })
  })

  it('re-provisions when an active DB is schema-only', async () => {
    const deps = baseDeps()
    deps.fetchSpaceDatabase.mockResolvedValue({
      status: 'active',
      backend: 'managed_pg',
      recordsEnabled: false,
    })

    await ensureInternalSpaceReady({ organizationId: 'org_1', spaceId: 'space_1' }, deps)

    expect(deps.enableRecords).toHaveBeenCalledWith('space_1')
    expect(deps.provisionDatabase).not.toHaveBeenCalled()
  })
})

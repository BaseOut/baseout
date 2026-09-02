import { describe, expect, it } from 'vitest'
import {
  isOrgRuntimeEnv,
  organizationIsWritableForEnv,
  productionLockoutEvent,
  resolveRuntimeEnv,
  sessionMatchesWorkerEnv,
  userCreateRuntimeEnvFields,
} from './runtime-env'

describe('isOrgRuntimeEnv', () => {
  it('accepts the three Worker environments', () => {
    expect(isOrgRuntimeEnv('dev')).toBe(true)
    expect(isOrgRuntimeEnv('staging')).toBe(true)
    expect(isOrgRuntimeEnv('production')).toBe(true)
  })

  it('rejects empty and unknown values', () => {
    expect(isOrgRuntimeEnv('')).toBe(false)
    expect(isOrgRuntimeEnv('local')).toBe(false)
    expect(isOrgRuntimeEnv(undefined)).toBe(false)
  })
})

describe('resolveRuntimeEnv', () => {
  it('prefers an explicit BASEOUT_ENV', () => {
    expect(resolveRuntimeEnv({ BASEOUT_ENV: 'staging', BASEOUT_DEV: 'true' })).toBe(
      'staging',
    )
  })

  it('falls back to dev when BASEOUT_DEV is true', () => {
    expect(resolveRuntimeEnv({ BASEOUT_DEV: 'true' })).toBe('dev')
  })

  it('fails closed when neither signal is valid', () => {
    expect(resolveRuntimeEnv({})).toBe(null)
    expect(resolveRuntimeEnv({ BASEOUT_ENV: 'preview' })).toBe(null)
  })
})

describe('sessionMatchesWorkerEnv', () => {
  it('treats a staging-tagged user on a dev worker as unauthenticated', () => {
    expect(sessionMatchesWorkerEnv('staging', 'dev')).toBe(false)
  })

  it('allows a matching user', () => {
    expect(sessionMatchesWorkerEnv('dev', 'dev')).toBe(true)
  })

  it('fails closed when the session user has no env stamp', () => {
    expect(sessionMatchesWorkerEnv(undefined, 'dev')).toBe(false)
  })
})

describe('userCreateRuntimeEnvFields', () => {
  it('stamps the Worker env onto a new user', () => {
    expect(userCreateRuntimeEnvFields('dev')).toEqual({ runtimeEnv: 'dev' })
  })

  it('omits the field when the Worker env is unknown', () => {
    expect(userCreateRuntimeEnvFields(null)).toEqual({})
  })
})

describe('organizationIsWritableForEnv', () => {
  it('rejects membership in an other-env Organization', () => {
    expect(
      organizationIsWritableForEnv({
        isMember: true,
        orgRuntimeEnv: 'staging',
        workerEnv: 'dev',
      }),
    ).toBe(false)
  })

  it('allows same-env members', () => {
    expect(
      organizationIsWritableForEnv({
        isMember: true,
        orgRuntimeEnv: 'dev',
        workerEnv: 'dev',
      }),
    ).toBe(true)
  })
})

describe('productionLockoutEvent', () => {
  it('fires when production Worker sees a non-empty table with zero production orgs', () => {
    expect(
      productionLockoutEvent({
        resolvedEnv: 'production',
        organizationCount: 12,
        productionTaggedCount: 0,
      }),
    ).toEqual({
      event: 'production_runtime_env_lockout',
      organizationCount: 12,
      productionTaggedCount: 0,
    })
  })

  it('is silent when any org is tagged production, or the table is empty, or env is not production', () => {
    expect(
      productionLockoutEvent({
        resolvedEnv: 'production',
        organizationCount: 12,
        productionTaggedCount: 1,
      }),
    ).toBe(null)
    expect(
      productionLockoutEvent({
        resolvedEnv: 'production',
        organizationCount: 0,
        productionTaggedCount: 0,
      }),
    ).toBe(null)
    expect(
      productionLockoutEvent({
        resolvedEnv: 'staging',
        organizationCount: 12,
        productionTaggedCount: 0,
      }),
    ).toBe(null)
  })
})

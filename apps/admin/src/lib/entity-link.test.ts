import { describe, expect, it } from 'vitest'
import { entityHref, isPeekable, PEEKABLE, type EntityType } from './entity-link'

describe('entityHref', () => {
  it('maps every entity type to its route (exhaustive)', () => {
    expect(entityHref('org', 'o1')).toBe('/organizations/o1')
    expect(entityHref('space', 's1')).toBe('/spaces/s1')
    expect(entityHref('user', 'u1')).toBe('/users/u1')
    expect(entityHref('backup_run', 'r1')).toBe('/backups/r1')
    expect(entityHref('connection', 'c1')).toBe('/connections#c1')
    expect(entityHref('restore_run', 'rr1')).toBe('/restores#rr1')
  })

  it('has a branch for every EntityType (no undefined return)', () => {
    const all: EntityType[] = ['org', 'space', 'user', 'connection', 'backup_run', 'restore_run']
    for (const t of all) expect(entityHref(t, 'x')).toMatch(/^\/[a-z]/)
  })
})

describe('isPeekable', () => {
  it('peekable types have a summary endpoint; restore_run does not', () => {
    for (const t of PEEKABLE) expect(isPeekable(t)).toBe(true)
    expect(isPeekable('restore_run')).toBe(false)
  })
})

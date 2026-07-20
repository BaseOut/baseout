import { describe, expect, it } from 'vitest'
import { entityHref, truncationNote } from './ui'

describe('truncationNote', () => {
  it('is empty below the limit', () => {
    expect(truncationNote(0, 100)).toBe('')
    expect(truncationNote(99, 100)).toBe('')
  })

  it('notes truncation at (or absurdly above) the limit', () => {
    expect(truncationNote(100, 100)).toBe(' Showing the most recent 100.')
    expect(truncationNote(101, 100)).toBe(' Showing the most recent 100.')
  })
})

describe('entityHref', () => {
  it('links an org to its drill-in', () => {
    expect(entityHref('org', 'org_1')).toBe('/organizations/org_1')
  })
  it('falls back space/user targets to the owning org drill-in (until detail routes exist)', () => {
    expect(entityHref('space', 'sp_1', 'org_9')).toBe('/organizations/org_9')
    expect(entityHref('user', 'u_1', 'org_9')).toBe('/organizations/org_9')
  })
  it('falls back to / when no owning org is known', () => {
    expect(entityHref('space', 'sp_1', null)).toBe('/')
    expect(entityHref('user', 'u_1')).toBe('/')
  })
})

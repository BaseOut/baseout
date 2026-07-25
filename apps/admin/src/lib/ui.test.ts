import { describe, expect, it } from 'vitest'
import { truncationNote } from './ui'

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

// entityHref moved to entity-link.ts (with real space/user routes) — see
// entity-link.test.ts.

import { describe, expect, it } from 'vitest'
import { fmtCount } from './fmtCount'

describe('fmtCount', () => {
  it('pins en-US grouping', () => {
    expect(fmtCount(0)).toBe('0')
    expect(fmtCount(12)).toBe('12')
    expect(fmtCount(1234)).toBe('1,234')
  })
})

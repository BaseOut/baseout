import { describe, expect, it } from 'vitest'
import { defaultRecordsPreset } from './system-preset'

describe('defaultRecordsPreset', () => {
  it('is a saved system preset, not a Draft', () => {
    const preset = defaultRecordsPreset('tbl1')
    expect(preset.name).toBe('All records')
    expect(preset.saved).toBe(true)
    expect(preset.temporary).toBe(false)
  })
})

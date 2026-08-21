import { describe, expect, it } from 'vitest'
import { lucideStripIcon } from './strip-icons'

describe('lucideStripIcon', () => {
  it('passes through an already-qualified lucide class', () => {
    expect(lucideStripIcon('lucide--database-backup')).toBe('lucide--database-backup')
  })

  it('maps the engine short names onto the catalog glyphs the KPI strip renders', () => {
    expect(lucideStripIcon('database')).toBe('lucide--database-backup')
    expect(lucideStripIcon('plug')).toBe('lucide--plug-zap')
    expect(lucideStripIcon('layers')).toBe('lucide--list-tree')
    expect(lucideStripIcon('file-text')).toBe('lucide--file-text')
  })

  it('prefixes an unknown short name rather than dropping the icon', () => {
    expect(lucideStripIcon('sparkles')).toBe('lucide--sparkles')
  })
})

import { describe, it, expect } from 'vitest'
import { describeRegistryRemoval } from './removal'

describe('describeRegistryRemoval', () => {
  it('names the source, base count, and OAuth re-auth cost', () => {
    const copy = describeRegistryRemoval({
      kind: 'source',
      name: 'Ops Airtable',
      authLabel: 'OAuth',
      basesAvailable: 3,
    })
    expect(copy.title).toBe('Remove Ops Airtable?')
    expect(copy.lead).toContain('3 bases')
    expect(copy.consequence).toContain('authorizing Airtable again from scratch')
    expect(copy.confirmLabel).toBe('Remove source')
  })

  it('singularizes a one-base source and names a PAT re-issue', () => {
    const copy = describeRegistryRemoval({
      kind: 'source',
      name: 'Solo',
      authLabel: 'Personal access token',
      basesAvailable: 1,
    })
    expect(copy.lead).toContain('1 base')
    expect(copy.lead).not.toContain('1 bases')
    expect(copy.consequence).toContain('issuing a new personal access token')
  })

  it('names destination detail and kind for the twin object', () => {
    const copy = describeRegistryRemoval({
      kind: 'destination',
      name: 'Company Drive',
      kindLabel: 'File storage',
      detail: 'folder /Baseout',
    })
    expect(copy.title).toBe('Remove Company Drive?')
    expect(copy.lead).toContain('file storage')
    expect(copy.lead).toContain('folder /Baseout')
    expect(copy.confirmLabel).toBe('Remove destination')
  })
})

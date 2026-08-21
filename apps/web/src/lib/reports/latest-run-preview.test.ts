import { describe, expect, it } from 'vitest'
import { latestRunPreviewCopy } from './latest-run-preview'

describe('latestRunPreviewCopy', () => {
  it('does not invent a generated timestamp when the run has none', () => {
    const copy = latestRunPreviewCopy({ generatedAt: null })
    expect(copy.when).not.toMatch(/Generated —/)
    expect(copy.when.toLowerCase()).toMatch(/not generated|not yet generated/)
    expect(copy.body).toMatch(/full breakdown/)
    expect(copy.body).not.toMatch(/\.\.\.|…/)
  })

  it('uses the relative stamp when generatedAt is present', () => {
    const copy = latestRunPreviewCopy({ generatedAt: '2h ago' })
    expect(copy.when).toBe('Generated 2h ago')
  })
})

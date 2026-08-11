// Governance guardrail for the React-island carve-out
// (openspec/changes/shared-schema-docs §5; see ./README.md).
//
// Islands are `.tsx` ONLY. An `.astro` file here would be invisible to the
// daisyUI-first classification audit (component-classification.test.ts globs
// `.astro`), silently bypassing §4.2. This test fails if one ever lands.

import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const islandsDir = fileURLToPath(new URL('.', import.meta.url))

describe('islands carve-out', () => {
  it('contains no .astro files (islands must be .tsx)', () => {
    const astro = readdirSync(islandsDir).filter((f) => f.endsWith('.astro'))
    expect(astro, `islands/ must be .tsx only; found ${astro.join(', ')}`).toEqual([])
  })

  it('documents the carve-out in a README', () => {
    const files = readdirSync(islandsDir)
    expect(files).toContain('README.md')
  })
})

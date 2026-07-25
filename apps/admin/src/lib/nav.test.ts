import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { NAV_GROUPS } from './nav'

const pagesDir = fileURLToPath(new URL('../pages', import.meta.url))

// Every nav href must resolve to a real page file (design 3.3 — no dead links).
function pageExists(href: string): boolean {
  const rel = href === '/' ? 'index' : href.replace(/^\//, '')
  return existsSync(join(pagesDir, `${rel}.astro`)) || existsSync(join(pagesDir, rel, 'index.astro'))
}

describe('NAV_GROUPS', () => {
  it('every item href maps to an existing page file', () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(pageExists(item.href), `${item.href} (${group.label}) has no page`).toBe(true)
      }
    }
  })

  it('has unique hrefs across all groups', () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

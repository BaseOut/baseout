import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with dashes', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp')
    expect(slugify('  Acme & Co, Inc.  ')).toBe('acme-co-inc')
  })

  it('strips diacritics', () => {
    expect(slugify('Société Générale')).toBe('societe-generale')
  })

  it('falls back to "organization" for empty input', () => {
    expect(slugify('')).toBe('organization')
    expect(slugify('!!!')).toBe('organization')
  })

  it('truncates to 40 chars', () => {
    const long = 'a'.repeat(80)
    expect(slugify(long)).toHaveLength(40)
  })
})

describe('uniqueSlug', () => {
  it('returns the base slug when unused', async () => {
    expect(await uniqueSlug('Acme', async () => false)).toBe('acme')
  })

  it('appends -2 when base is taken', async () => {
    const used = new Set(['acme'])
    expect(await uniqueSlug('Acme', async (c) => used.has(c))).toBe('acme-2')
  })

  it('appends -3 when base and -2 are taken', async () => {
    const used = new Set(['acme', 'acme-2'])
    expect(await uniqueSlug('Acme', async (c) => used.has(c))).toBe('acme-3')
  })

  it('falls back to a 6-hex suffix after -5 is taken', async () => {
    const used = new Set(['acme', 'acme-2', 'acme-3', 'acme-4', 'acme-5'])
    const result = await uniqueSlug('Acme', async (c) => used.has(c))
    expect(result).toMatch(/^acme-[a-f0-9]{6}$/)
  })

  it('throws after 8 total attempts all collide', async () => {
    const attempts: string[] = []
    await expect(
      uniqueSlug('Acme', async (c) => {
        attempts.push(c)
        return true
      }),
    ).rejects.toThrow(/after 8 attempts/)
    expect(attempts).toHaveLength(8)
    expect(attempts[0]).toBe('acme')
    expect(attempts.slice(1, 5)).toEqual(['acme-2', 'acme-3', 'acme-4', 'acme-5'])
    for (const candidate of attempts.slice(5)) {
      expect(candidate).toMatch(/^acme-[a-f0-9]{6}$/)
    }
  })
})

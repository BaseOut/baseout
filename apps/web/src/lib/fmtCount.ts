/**
 * Locale-pinned count formatting (design-audit item 33). Bare `toLocaleString()`
 * follows the runtime locale; the product is en-US (D09 / lib/time.ts).
 */
const LOCALE = 'en-US'

export function fmtCount(n: number): string {
  return n.toLocaleString(LOCALE)
}

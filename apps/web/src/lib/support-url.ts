/**
 * Optional public support-portal origin (apps/support). Empty / missing
 * keeps the in-app `/help` mailto door. When set, Help CTAs can name a
 * real host without inventing DNS (support Phase 5).
 */
export function resolvePublicSupportUrl(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
    return `${url.origin}${path}`
  } catch {
    return null
  }
}

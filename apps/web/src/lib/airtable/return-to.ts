/**
 * Validates a post-OAuth return path supplied by the browser.
 *
 * Anything other than a same-origin, app-route path is rejected so the OAuth
 * callback cannot be turned into an open-redirect vector. Returns the trimmed
 * path on success, `null` otherwise — callers fall back to a hard-coded default.
 */

const MAX_LENGTH = 512

export function sanitizeReturnTo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) return null
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  if (trimmed.startsWith('/\\')) return null
  if (trimmed.includes('://')) return null
  if (trimmed === '/api' || trimmed.startsWith('/api/')) return null
  return trimmed
}

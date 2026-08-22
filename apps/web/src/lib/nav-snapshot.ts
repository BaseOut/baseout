/**
 * Short-TTL private snapshots for SSR navigation.
 *
 * Astro prefetch + ClientRouter only reuse a document when it has freshness
 * headers. Without Cache-Control, hover prefetch is thrown away and the click
 * SSRs again (withastro/astro#17549, Astro prefetch guide).
 *
 * `private` keeps the copy in the user's browser, never a shared CDN — these
 * pages are session-specific. Skip when Set-Cookie is present so a sliding
 * session cookie is not frozen into a cached body.
 */
export const NAV_SNAPSHOT_TTL_SEC = 15

export const NAV_SNAPSHOT_CACHE_CONTROL = `private, max-age=${NAV_SNAPSHOT_TTL_SEC}`

const SKIP_PREFIXES = ['/api/', '/_image', '/_astro']
const SKIP_EXACT = new Set([
  '/login',
  '/register',
  '/2fa',
  '/welcome',
  '/embed',
  '/logout',
])

export function shouldApplyNavSnapshot(input: {
  method: string
  pathname: string
  status: number
  hasSetCookie: boolean
  existingCacheControl: string | null
}): boolean {
  if (input.method !== 'GET' && input.method !== 'HEAD') return false
  if (input.status !== 200) return false
  if (input.hasSetCookie) return false
  if (input.existingCacheControl) return false
  const path = input.pathname
  if (SKIP_EXACT.has(path)) return false
  for (const prefix of SKIP_PREFIXES) {
    if (path.startsWith(prefix)) return false
  }
  return true
}

export function applyNavSnapshotHeaders(
  res: Response,
  req: { method: string; pathname: string },
): Response {
  if (
    !shouldApplyNavSnapshot({
      method: req.method,
      pathname: req.pathname,
      status: res.status,
      hasSetCookie: res.headers.has('Set-Cookie'),
      existingCacheControl: res.headers.get('Cache-Control'),
    })
  ) {
    return res
  }
  try {
    res.headers.set('Cache-Control', NAV_SNAPSHOT_CACHE_CONTROL)
    res.headers.append('Vary', 'Cookie')
    return res
  } catch {
    const out = new Response(res.body, res)
    out.headers.set('Cache-Control', NAV_SNAPSHOT_CACHE_CONTROL)
    out.headers.append('Vary', 'Cookie')
    return out
  }
}

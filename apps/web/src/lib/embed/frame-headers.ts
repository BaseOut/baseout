// frame-ancestors CSP for embedded mode (shared-embed-protocol, spec
// web-embedded-mode). One allowlist source of truth: the protocol package's
// parser also validates handshake origins in the child bridge, so the header
// and the bridge can never disagree about who may embed us.
import { frameAncestorsValue, parseAllowlist } from '@baseout/embed-protocol'

export function buildFrameAncestors(raw: string | undefined | null): string {
  return frameAncestorsValue(parseAllowlist(raw))
}

const isHtml = (res: Response): boolean =>
  (res.headers.get('content-type') ?? '').includes('text/html')

/**
 * Set the frame-ancestors CSP on HTML responses. Clones when workerd hands us
 * an immutable-header response (same fallback as middleware appendSetCookies).
 * Never overwrites an existing Content-Security-Policy (none is set today —
 * if one appears, frame-ancestors should be merged there, not clobbered).
 */
export function applyFrameAncestors(res: Response, headerValue: string): Response {
  if (!isHtml(res) || res.headers.has('content-security-policy')) return res
  try {
    res.headers.set('content-security-policy', headerValue)
    return res
  } catch {
    const out = new Response(res.body, res)
    out.headers.set('content-security-policy', headerValue)
    return out
  }
}

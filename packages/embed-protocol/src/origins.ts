// Ancestor-allowlist parsing + origin matching — the ONE source of truth for
// both enforcement points: the child bridge's handshake validation and the
// web app's Content-Security-Policy frame-ancestors directive
// (openspec/changes/shared-embed-protocol design Decision 4).
//
// Entry forms (comma-separated in config):
//   https://airtable.com                exact origin
//   https://*.airtableblocks.com        single-level wildcard subdomain
//   chrome-extension://<id>             exact extension origin
//   chrome-extension://*                any extension (dev configs only)
//
// Matching is on origin (scheme + host + port) — never path. A wildcard does
// NOT match the bare apex or multiple subdomain levels.

export type AncestorPattern =
  | { kind: 'exact'; origin: string }
  | { kind: 'wildcard-subdomain'; scheme: string; suffix: string }
  | { kind: 'any-extension'; scheme: string }

export function parseAllowlist(raw: string | undefined | null): AncestorPattern[] {
  if (!raw) return []
  const patterns: AncestorPattern[] = []
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\/(.+)$/i.exec(entry)
    const [, rawScheme, host] = schemeMatch ?? []
    if (!rawScheme || !host) continue // not an origin — drop, never throw on config
    const scheme = rawScheme.toLowerCase()
    if (host === '*') {
      // Scheme-wide wildcard is only meaningful for extension schemes, where
      // per-install ids make exact pinning impractical in dev.
      if (scheme.endsWith('-extension')) patterns.push({ kind: 'any-extension', scheme })
      continue
    }
    if (host.startsWith('*.')) {
      patterns.push({ kind: 'wildcard-subdomain', scheme, suffix: host.slice(1).toLowerCase() })
      continue
    }
    patterns.push({ kind: 'exact', origin: `${scheme}://${host.toLowerCase()}` })
  }
  return patterns
}

/** Does a concrete origin (e.g. MessageEvent.origin) match the allowlist? */
export function originMatches(origin: string, patterns: AncestorPattern[]): boolean {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  const normalized = parsed.origin.toLowerCase()
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase()
  const host = parsed.hostname.toLowerCase()

  for (const p of patterns) {
    if (p.kind === 'exact' && normalized === p.origin) return true
    if (p.kind === 'any-extension' && scheme === p.scheme) return true
    if (p.kind === 'wildcard-subdomain' && scheme === p.scheme) {
      // exactly one extra label: "a.example.com" matches "*.example.com";
      // "example.com" and "a.b.example.com" do not.
      if (host.endsWith(p.suffix)) {
        const sub = host.slice(0, host.length - p.suffix.length)
        if (sub.length > 0 && !sub.includes('.')) return true
      }
    }
  }
  return false
}

/**
 * Render the allowlist as CSP frame-ancestors source expressions.
 * `chrome-extension://*` becomes the CSP scheme-source `chrome-extension:`
 * (CSP has no scheme-wide host wildcard). Always includes 'self'.
 */
export function frameAncestorsValue(patterns: AncestorPattern[]): string {
  const sources = ["'self'"]
  for (const p of patterns) {
    if (p.kind === 'exact') sources.push(p.origin)
    else if (p.kind === 'wildcard-subdomain') sources.push(`${p.scheme}://*${p.suffix}`)
    else sources.push(`${p.scheme}:`)
  }
  return `frame-ancestors ${[...new Set(sources)].join(' ')}`
}

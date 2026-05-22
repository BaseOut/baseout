/**
 * Provider-agnostic PKCE + state generation.
 *
 * Extracted from lib/airtable/oauth.ts and lib/google-drive/oauth.ts per
 * shared-byos-drive-dropbox design.md §C.3.0 — three real call sites
 * (Airtable, Google Drive, Dropbox) justify the extraction per
 * CLAUDE.md §3.2. Provider-specific shims under lib/<provider>/oauth.ts
 * re-export these unchanged.
 */

const VERIFIER_BYTES = 64

function toUrlSafeBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export interface PkcePair {
  verifier: string
  challenge: string
}

export async function generatePkcePair(): Promise<PkcePair> {
  const raw = crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))
  const verifier = toUrlSafeBase64(raw)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  const challenge = toUrlSafeBase64(new Uint8Array(digest))
  return { verifier, challenge }
}

export function generateState(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  return toUrlSafeBase64(raw)
}

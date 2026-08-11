/**
 * Structured event logging for apps/web — the project logger utility that
 * CLAUDE.md §3.5 sanctions in place of raw console.* calls. One JSON line per
 * event so Workers log tails / Logpush can filter on `event`.
 *
 * First consumers: api_token.created / api_token.revoked (web-api-tokens
 * design D5 — interim until the customer audit-log table exists, tracked in
 * questions-2026-07-20 item 12). NEVER pass secrets, plaintext tokens, or
 * hashes in `fields`.
 */

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console -- the sanctioned structured-logger sink (§3.5)
  console.log(JSON.stringify({ event, ...fields }))
}

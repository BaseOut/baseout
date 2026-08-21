/**
 * Detect Airtable auth / permission failures from backup-base error strings.
 *
 * OAuth refresh cron only flips connections to `pending_reauth` when the
 * *token endpoint* rejects (`invalid_grant`, etc.). Backup can still fail with
 * HTTP 401/403 (e.g. INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND) while refresh
 * succeeds — the connection stays `active` and the Sources UI never offers
 * Reconnect. Matching those run errors lets run-complete mark pending_reauth.
 */

export function isAirtableAuthFailureMessage(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const m = message.toLowerCase();

  if (/\bairtable returned 40[13]\b/.test(m)) return true;
  if (m.includes("invalid_permissions_or_model_not_found")) return true;
  // Early token-fetch failures from backup-base (`failed("token_403", …)`).
  if (/\btoken_40[13]\b/.test(m)) return true;
  if (m.includes("unauthorized") && m.includes("airtable")) return true;

  return false;
}

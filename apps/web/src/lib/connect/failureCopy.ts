/**
 * failureCopy — the ONE code→sentence table for a failed connect or rescan (audit D32, D04).
 *
 * Provenance. Until 2026-08-14 these nineteen sentences lived in `views/IntegrationsView.astro`,
 * a view no route imports: ten connect codes at `:50-61`, nine rescan codes at `:489-511`. Eight of
 * the same connect codes were ALSO written, in different words and a different character set, in
 * `components/backups/StoragePicker.astro:476-493`. So the product shipped the engineer's register
 * and kept the writer's copy in a dead file. D32 merges them here, once:
 *
 *   the writer's sentence  +  the live deck's remedy clause  =  one sentence per code.
 *
 * Voice (specs/00-design-principles.md): direct, second person, no exclamation marks. Per D04 a
 * failure names WHAT happened, WHOSE scope it is, and WHAT the user can do — so a sentence that has
 * an actionable remedy carries it, and one that does not says so rather than pretending.
 *
 * Subject. Every connect sentence names the provider, because the same code is emitted by the
 * Airtable source flow and by the storage-destination flow and the two are not the same failure to
 * the reader. `subject` is REQUIRED for that reason: there is no honest generic fallback, and each
 * caller always knows which provider it just tried to reach.
 */

export type ConnectFailureCode =
  | 'access_denied'
  | 'missing_code'
  | 'missing_handoff'
  | 'invalid_handoff'
  | 'state_mismatch'
  | 'user_mismatch'
  | 'token_exchange_failed'
  | 'api_call_failed'
  | 'persist_failed'
  | 'not_configured';

/** Declaration order is the order the OAuth round-trip can produce them. */
export const CONNECT_FAILURE_CODES: readonly ConnectFailureCode[] = [
  'access_denied',
  'missing_code',
  'missing_handoff',
  'invalid_handoff',
  'state_mismatch',
  'user_mismatch',
  'token_exchange_failed',
  'api_call_failed',
  'persist_failed',
  'not_configured',
];

/**
 * `{provider}` is substituted with the display name of the provider the user tried to reach.
 * Where a sentence merges two decks the second clause is the live deck's remedy or cause — kept
 * because it is the only actionable half either set offered.
 */
const CONNECT_FAILURES: Record<ConnectFailureCode, string> = {
  access_denied: 'You declined to give Baseout access to your {provider} account.',
  missing_code: '{provider} did not return an authorization code. Please try again.',
  missing_handoff:
    'Your session expired before {provider} returned. Please try again — if it keeps happening, allow cookies for this site.',
  invalid_handoff: 'We could not verify the sign-in handoff. Please try again from the start.',
  state_mismatch:
    'Security check failed. Please start the connection over — this can happen if you finish the flow in a different browser tab.',
  user_mismatch:
    'This connection does not belong to the signed-in user. Please try again from the right account.',
  token_exchange_failed:
    '{provider} rejected the connection. Please try again — if it keeps happening, the OAuth app credentials may have rotated.',
  api_call_failed: 'We connected to {provider} but could not list your bases.',
  persist_failed:
    'The connection succeeded but we could not save it. Please try again.',
  not_configured: '{provider} is not configured on this environment.',
};

/** The unknown-code sentence, verbatim from the deck (`IntegrationsView.astro:63`). */
export const CONNECT_FAILURE_FALLBACK = 'Connection failed. Please try again.';

export function isConnectFailureCode(code: string | null | undefined): code is ConnectFailureCode {
  return typeof code === 'string' && code in CONNECT_FAILURES;
}

/**
 * One sentence for one code. An unrecognised (or absent) code still gets a sentence, because
 * "something failed and we said nothing" is the defect this module exists to remove.
 *
 * @param subject display name of the provider — "Airtable", "Google Drive", "Postgres".
 */
export function connectFailureMessage(
  code: string | null | undefined,
  subject: string,
): string | null {
  if (!code) return null;
  const template = isConnectFailureCode(code) ? CONNECT_FAILURES[code] : CONNECT_FAILURE_FALLBACK;
  return template.split('{provider}').join(subject);
}

/**
 * The full failure for a form-level slot: the sentence plus the raw code, which stays visible
 * because this app's user is a technical operator and the code is what a support thread matches
 * on (D32 amendment). It is labelled for a reader, not printed as `error_code:`.
 */
export function connectFailure(
  code: string | null | undefined,
  subject: string,
): { code: string; message: string } | null {
  const message = connectFailureMessage(code, subject);
  if (!message || !code) return null;
  return { code, message };
}

/* ── Rescan / base-refresh ─────────────────────────────────────────────────────────────────────
 * The second table from the same dead view (`describeRescanError`). It is preserved verbatim so
 * nothing is lost when the view goes; see the note in the repo report about `engine_unreachable`
 * and `unauthorized`, whose wording is engineer-facing and wants the writer before it is shown to
 * anyone. NOTE: no live surface calls this yet — `SourceDetailView`'s "Refresh bases" is the
 * surface that must, and it is outside D32's connect-flow file set.
 */

export type RescanFailureCode =
  | 'connection_not_found'
  | 'space_not_found'
  | 'space_org_mismatch'
  | 'config_not_found'
  | 'airtable_error'
  | 'engine_unreachable'
  | 'server_misconfigured'
  | 'unauthorized'
  | 'engine_error';

export const RESCAN_FAILURE_CODES: readonly RescanFailureCode[] = [
  'connection_not_found',
  'space_not_found',
  'space_org_mismatch',
  'config_not_found',
  'airtable_error',
  'engine_unreachable',
  'server_misconfigured',
  'unauthorized',
  'engine_error',
];

/** `{status}` is substituted with the HTTP status the engine answered with. */
const RESCAN_FAILURES: Record<RescanFailureCode, string> = {
  connection_not_found: 'No active Airtable connection. Reconnect Airtable to rescan.',
  space_not_found: 'This space is not visible to your account.',
  space_org_mismatch: 'This space is not visible to your account.',
  config_not_found: 'This space has no backup configuration yet.',
  airtable_error: 'Airtable did not respond as expected. Try again in a moment.',
  engine_unreachable:
    'The backup engine is not running. Start `pnpm --filter @baseout/server dev`.',
  server_misconfigured:
    'The backup engine binding or token is not configured. Contact support.',
  unauthorized:
    'Service-to-service auth failed (web↔engine token mismatch). Contact support.',
  engine_error: 'Engine returned an unexpected error (HTTP {status}). Try again.',
};

export const RESCAN_FAILURE_FALLBACK = 'Rescan failed (HTTP {status}). Please try again.';

export function isRescanFailureCode(code: string | null | undefined): code is RescanFailureCode {
  return typeof code === 'string' && code in RESCAN_FAILURES;
}

export function rescanFailureMessage(code: string | null | undefined, status: number): string {
  const template = isRescanFailureCode(code) ? RESCAN_FAILURES[code] : RESCAN_FAILURE_FALLBACK;
  return template.split('{status}').join(String(status));
}

export interface AirtableTokenConnection {
  id: string;
  status: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  scopes: string | null;
  oauthRefreshClaimId: string | null;
  oauthRefreshClaimedAt: Date | null;
}

export type AirtableRefreshOutcome =
  | {
      kind: "success";
      accessToken: string;
      refreshToken: string;
      expiresAtMs: number;
      scope: string | null;
    }
  | { kind: "pending_reauth"; reason: string }
  | { kind: "transient"; reason: string; retryAfterMs?: number }
  | { kind: "invalid"; reason: string };

export interface ResolveAirtableTokenDeps {
  now: () => Date;
  newClaimId: () => string;
  fetchConnection: (
    connectionId: string,
  ) => Promise<AirtableTokenConnection | null>;
  decrypt: (ciphertext: string) => Promise<string>;
  encrypt: (plaintext: string) => Promise<string>;
  claimRefresh: (input: {
    connectionId: string;
    claimId: string;
    staleBefore: Date;
  }) => Promise<AirtableTokenConnection | null>;
  persistRefreshSuccess: (input: {
    connectionId: string;
    claimId: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    tokenExpiresAt: Date;
    scopes: string | null;
  }) => Promise<boolean>;
  markPendingReauth: (input: {
    connectionId: string;
    claimId: string;
    reason: string;
  }) => Promise<void>;
  clearRefreshClaim: (input: {
    connectionId: string;
    claimId: string;
    error: string;
  }) => Promise<void>;
  observeConnection: (
    connectionId: string,
  ) => Promise<AirtableTokenConnection | null>;
  refresh: (input: {
    refreshToken: string;
  }) => Promise<AirtableRefreshOutcome>;
  log: (event: Record<string, unknown>) => void;
}

export type ResolveAirtableTokenResult =
  | { ok: true; accessToken: string; refreshed: boolean }
  | {
      ok: false;
      error:
        | "connection_not_found"
        | "inactive_connection"
        | "missing_refresh_token"
        | "refresh_claim_unavailable"
        | "refresh_transient"
        | "reauth_required"
        | "refresh_invalid"
        | "persist_failed";
      reason?: string;
    };

export interface ResolveAirtableTokenInput {
  connectionId: string;
  refreshEnabled: boolean;
}

const REFRESH_LOOKAHEAD_MS = 5 * 60_000;
const CLAIM_STALE_MS = 2 * 60_000;

function shouldRefresh(
  tokenExpiresAt: Date | null,
  nowMs: number,
): boolean {
  return (
    tokenExpiresAt === null ||
    tokenExpiresAt.getTime() <= nowMs + REFRESH_LOOKAHEAD_MS
  );
}

export async function resolveAirtableToken(
  input: ResolveAirtableTokenInput,
  deps: ResolveAirtableTokenDeps,
): Promise<ResolveAirtableTokenResult> {
  const connection = await deps.fetchConnection(input.connectionId);
  if (!connection) return { ok: false, error: "connection_not_found" };
  if (connection.status !== "active") {
    return { ok: false, error: "inactive_connection" };
  }

  const now = deps.now();
  if (
    !input.refreshEnabled ||
    !shouldRefresh(connection.tokenExpiresAt, now.getTime())
  ) {
    return {
      ok: true,
      accessToken: await deps.decrypt(connection.accessTokenEnc),
      refreshed: false,
    };
  }

  if (!connection.refreshTokenEnc) {
    return { ok: false, error: "missing_refresh_token" };
  }

  const claimId = deps.newClaimId();
  const claimed = await deps.claimRefresh({
    connectionId: input.connectionId,
    claimId,
    staleBefore: new Date(now.getTime() - CLAIM_STALE_MS),
  });
  if (!claimed) return { ok: false, error: "refresh_claim_unavailable" };

  const plaintextRefresh = await deps.decrypt(claimed.refreshTokenEnc!);
  const outcome = await deps.refresh({ refreshToken: plaintextRefresh });

  if (outcome.kind === "pending_reauth") {
    await deps.markPendingReauth({
      connectionId: input.connectionId,
      claimId,
      reason: outcome.reason,
    });
    return {
      ok: false,
      error: "reauth_required",
      reason: outcome.reason,
    };
  }

  if (outcome.kind === "transient") {
    await deps.clearRefreshClaim({
      connectionId: input.connectionId,
      claimId,
      error: outcome.reason,
    });
    return {
      ok: false,
      error: "refresh_transient",
      reason: outcome.reason,
    };
  }

  if (outcome.kind === "invalid") {
    await deps.clearRefreshClaim({
      connectionId: input.connectionId,
      claimId,
      error: outcome.reason,
    });
    return {
      ok: false,
      error: "refresh_invalid",
      reason: outcome.reason,
    };
  }

  const accessTokenEnc = await deps.encrypt(outcome.accessToken);
  const refreshTokenEnc = await deps.encrypt(outcome.refreshToken);
  const persisted = await deps.persistRefreshSuccess({
    connectionId: input.connectionId,
    claimId,
    accessTokenEnc,
    refreshTokenEnc,
    tokenExpiresAt: new Date(outcome.expiresAtMs),
    scopes: outcome.scope,
  });

  if (!persisted) {
    const observed = await deps.observeConnection(input.connectionId);
    deps.log({
      event: "airtable_token_refresh_persist_failed",
      connectionId: input.connectionId,
      claimId,
      observedClaimId: observed?.oauthRefreshClaimId ?? null,
      observedStatus: observed?.status ?? null,
    });
    return { ok: false, error: "persist_failed" };
  }

  return {
    ok: true,
    accessToken: outcome.accessToken,
    refreshed: true,
  };
}

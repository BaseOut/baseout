// Lazy Airtable access-token resolution for backup + rediscovery paths.
//
// Mirrors the storage-destination handler pattern: read the Connection row
// from master DB, refresh when near expiry (or on ?refresh=1), persist
// rotated tokens, return plaintext access token. The workflows runner never
// holds refresh tokens — only the engine decrypts *_enc columns.

import { eq } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import { connections } from "../../db/schema";
import { decryptToken, encryptToken } from "../crypto";
import {
  refreshAirtableAccessToken,
  type RefreshOutcome,
} from "../airtable-refresh";

export const AIRTABLE_TOKEN_REFRESH_LEEWAY_MS = 5 * 60_000;

export interface ResolveAirtableTokenInput {
  connectionId: string;
  forceRefresh: boolean;
  encryptionKey: string;
  clientId: string;
  clientSecret: string;
  now?: () => Date;
  refresh?: typeof refreshAirtableAccessToken;
}

export type ResolveAirtableTokenResult =
  | { ok: true; accessToken: string; expiresAt: string }
  | {
      ok: false;
      error:
        | "connection_not_found"
        | "connection_status"
        | "missing_refresh_token"
        | "decrypt_failed"
        | "encrypt_failed"
        | "refresh_transient"
        | "pending_reauth"
        | "refresh_invalid";
      reason?: string;
    };

function shouldRefreshAccessToken(
  tokenExpiresAt: Date | null,
  forceRefresh: boolean,
  nowMs: number,
): boolean {
  if (forceRefresh) return true;
  if (!tokenExpiresAt) return true;
  return tokenExpiresAt.getTime() - nowMs < AIRTABLE_TOKEN_REFRESH_LEEWAY_MS;
}

async function persistRefreshSuccess(
  db: AppDb,
  connectionId: string,
  outcome: Extract<RefreshOutcome, { kind: "success" }>,
  encryptionKey: string,
): Promise<{ accessToken: string; expiresAt: string } | "encrypt_failed"> {
  const expiresAt = new Date(outcome.expiresAtMs);
  let accessEnc: string;
  let refreshEnc: string;
  try {
    accessEnc = await encryptToken(outcome.accessToken, encryptionKey);
    refreshEnc = await encryptToken(outcome.refreshToken, encryptionKey);
  } catch {
    return "encrypt_failed";
  }

  await db
    .update(connections)
    .set({
      accessTokenEnc: accessEnc,
      refreshTokenEnc: refreshEnc,
      tokenExpiresAt: expiresAt,
      scopes: outcome.scope,
      status: "active",
      invalidatedAt: null,
      modifiedAt: new Date(),
    })
    .where(eq(connections.id, connectionId));

  return {
    accessToken: outcome.accessToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function resolveAirtableConnectionToken(
  db: AppDb,
  input: ResolveAirtableTokenInput,
): Promise<ResolveAirtableTokenResult> {
  const now = input.now ?? (() => new Date());
  const nowMs = now().getTime();
  const refreshFn = input.refresh ?? refreshAirtableAccessToken;

  const [row] = await db
    .select({
      id: connections.id,
      status: connections.status,
      accessTokenEnc: connections.accessTokenEnc,
      refreshTokenEnc: connections.refreshTokenEnc,
      tokenExpiresAt: connections.tokenExpiresAt,
    })
    .from(connections)
    .where(eq(connections.id, input.connectionId))
    .limit(1);

  if (!row) return { ok: false, error: "connection_not_found" };
  if (row.status !== "active") {
    return { ok: false, error: "connection_status" };
  }

  const needsRefresh = shouldRefreshAccessToken(
    row.tokenExpiresAt,
    input.forceRefresh,
    nowMs,
  );

  if (needsRefresh) {
    if (!row.refreshTokenEnc) {
      return { ok: false, error: "missing_refresh_token" };
    }

    let refreshPlain: string;
    try {
      refreshPlain = await decryptToken(
        row.refreshTokenEnc,
        input.encryptionKey,
      );
    } catch {
      await db
        .update(connections)
        .set({ status: "pending_reauth", modifiedAt: new Date() })
        .where(eq(connections.id, row.id));
      return { ok: false, error: "decrypt_failed" };
    }

    const outcome = await refreshFn({
      refreshToken: refreshPlain,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      nowMs: () => nowMs,
    });

    if (outcome.kind === "transient") {
      return {
        ok: false,
        error: "refresh_transient",
        reason: outcome.reason,
      };
    }
    if (outcome.kind === "pending_reauth" || outcome.kind === "invalid") {
      await db
        .update(connections)
        .set({ status: "pending_reauth", modifiedAt: new Date() })
        .where(eq(connections.id, row.id));
      return {
        ok: false,
        error: "pending_reauth",
        reason: outcome.reason,
      };
    }

    const persisted = await persistRefreshSuccess(
      db,
      row.id,
      outcome,
      input.encryptionKey,
    );
    if (persisted === "encrypt_failed") {
      return { ok: false, error: "encrypt_failed" };
    }
    return { ok: true, ...persisted };
  }

  try {
    const accessToken = await decryptToken(
      row.accessTokenEnc,
      input.encryptionKey,
    );
    const expiresAt =
      row.tokenExpiresAt?.toISOString() ??
      new Date(nowMs + 60 * 60_000).toISOString();
    return { ok: true, accessToken, expiresAt };
  } catch {
    await db
      .update(connections)
      .set({ status: "pending_reauth", modifiedAt: new Date() })
      .where(eq(connections.id, row.id));
    return { ok: false, error: "decrypt_failed" };
  }
}

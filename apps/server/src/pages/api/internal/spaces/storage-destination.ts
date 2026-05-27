// GET /api/internal/spaces/:spaceId/storage-destination
//
// Filed by openspec/changes/shared-byos-drive Phase 3; Box dispatch added by
// the box-provider commit chain (3/3); Dropbox dispatch added by the
// dropbox-provider commit chain (3/3). The workflows runner (Node, no master
// encryption key) calls this at backup-base task start to fetch the decrypted
// access token for the Space's storage destination. The engine:
//   1. SELECTs the storage_destinations row.
//   2. Decrypts the access + refresh token columns.
//   3. If `oauthExpiresAt - now < 5 min` OR `?refresh=1` query: calls the
//      type-specific refresh helper, re-encrypts the new access token (and
//      for Box, the new ROTATED refresh token too), persists back. Updates
//      last_validated_at.
//   4. Returns plaintext {type, accessToken, expiresAt, providerFolderId}.
//      Refresh token NEVER returned — workflows re-hits this endpoint with
//      ?refresh=1 on a mid-upload 401.
//
// Result-code mapping:
//   row missing                                          → 404 { error: 'not_found' }
//   type='local_fs'                                      → 200 { type: 'local_fs' }
//   type='google_drive'|'box'|'dropbox' fresh            → 200 { type, accessToken, expiresAt, providerFolderId }
//   type='google_drive'|'box'|'dropbox' near-expiry      → refresh, then 200
//   type='google_drive'|'box'|'dropbox' ?refresh=1       → force refresh, then 200
//   refresh transient                                    → 502 { error: 'refresh_transient', reason }
//   refresh pending_reauth                               → 409 { error: 'pending_reauth', reason }
//   refresh invalid                                      → 502 { error: 'refresh_invalid', reason }
//
// Refresh-token persistence by provider:
//   - Drive + Dropbox: refresh response omits refresh_token (stable);
//     handler preserves stored oauth_refresh_token_enc on refresh.
//   - Box: refresh response carries a NEW refresh_token (rotation); handler
//     re-encrypts and persists it on every successful refresh, otherwise
//     the next refresh fails with invalid_grant.
//
// Token gate is applied by middleware (path begins /api/internal/).

import { eq, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { storageDestinations } from "../../../../db/schema";
import { decryptToken, encryptToken } from "../../../../lib/crypto";
import { refreshDriveAccessToken } from "../../../../lib/storage/refresh-drive";
import { refreshBoxAccessToken } from "../../../../lib/storage/refresh-box";
import { refreshDropboxAccessToken } from "../../../../lib/storage/refresh-dropbox";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFRESH_LEEWAY_MS = 5 * 60_000;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesStorageDestinationHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const { db } = locals.getMasterDb();
  const [row] = await db
    .select({
      id: storageDestinations.id,
      type: storageDestinations.type,
      oauthAccessTokenEnc: storageDestinations.oauthAccessTokenEnc,
      oauthRefreshTokenEnc: storageDestinations.oauthRefreshTokenEnc,
      oauthExpiresAt: storageDestinations.oauthExpiresAt,
      providerFolderId: storageDestinations.providerFolderId,
    })
    .from(storageDestinations)
    .where(eq(storageDestinations.spaceId, spaceId))
    .limit(1);

  if (!row) {
    return jsonResponse({ error: "not_found" }, 404);
  }

  if (row.type === "local_fs") {
    return jsonResponse({ type: "local_fs" }, 200);
  }

  // From here on, type ∈ { 'google_drive', 'box' } (the CHECK constraint
  // enforces the set). All OAuth-backed providers share the same row shape:
  // we need access+refresh tokens encrypted and a provider folder id.
  if (
    !row.oauthAccessTokenEnc ||
    !row.oauthRefreshTokenEnc ||
    !row.providerFolderId
  ) {
    // Row exists but is missing the columns workflows needs. Treat as a
    // half-connected state — surface as not_found so the task fails cleanly.
    return jsonResponse({ error: "not_found" }, 404);
  }

  const accessTokenEncrypted = row.oauthAccessTokenEnc;
  const refreshTokenEncrypted = row.oauthRefreshTokenEnc;
  const providerFolderId = row.providerFolderId;
  const expiresAt = row.oauthExpiresAt;
  const expiresAtMs = expiresAt ? expiresAt.getTime() : 0;
  const nearExpiry = expiresAtMs - Date.now() < REFRESH_LEEWAY_MS;
  const shouldRefresh = forceRefresh || nearExpiry;

  if (row.type === "google_drive") {
    let accessTokenPlain: string;
    let expiresAtIso: string;

    if (shouldRefresh) {
      let refreshTokenPlain: string;
      try {
        refreshTokenPlain = await decryptToken(
          refreshTokenEncrypted,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "decrypt_failed" }, 500);
      }

      const outcome = await refreshDriveAccessToken({
        refreshToken: refreshTokenPlain,
        clientId: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      });

      if (outcome.kind === "transient") {
        return jsonResponse(
          { error: "refresh_transient", reason: outcome.reason },
          502,
        );
      }
      if (outcome.kind === "pending_reauth") {
        return jsonResponse(
          { error: "pending_reauth", reason: outcome.reason },
          409,
        );
      }
      if (outcome.kind === "invalid") {
        return jsonResponse(
          { error: "refresh_invalid", reason: outcome.reason },
          502,
        );
      }

      // outcome.kind === 'success'
      const newExpiresAt = new Date(outcome.expiresAtMs);
      let newAccessTokenEnc: string;
      try {
        newAccessTokenEnc = await encryptToken(
          outcome.accessToken,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "encrypt_failed" }, 500);
      }

      await db
        .update(storageDestinations)
        .set({
          oauthAccessTokenEnc: newAccessTokenEnc,
          oauthExpiresAt: newExpiresAt,
          oauthScope: outcome.scope ?? sql`${storageDestinations.oauthScope}`,
          lastValidatedAt: new Date(),
        })
        .where(eq(storageDestinations.id, row.id));

      accessTokenPlain = outcome.accessToken;
      expiresAtIso = newExpiresAt.toISOString();
    } else {
      try {
        accessTokenPlain = await decryptToken(
          accessTokenEncrypted,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "decrypt_failed" }, 500);
      }
      expiresAtIso = expiresAt!.toISOString();

      // Touch last_validated_at on every successful read so ops can spot
      // long-idle destinations.
      await db
        .update(storageDestinations)
        .set({ lastValidatedAt: new Date() })
        .where(eq(storageDestinations.id, row.id));
    }

    return jsonResponse(
      {
        type: "google_drive",
        accessToken: accessTokenPlain,
        expiresAt: expiresAtIso,
        providerFolderId,
      },
      200,
    );
  }

  if (row.type === "box") {
    let accessTokenPlain: string;
    let expiresAtIso: string;

    if (shouldRefresh) {
      let refreshTokenPlain: string;
      try {
        refreshTokenPlain = await decryptToken(
          refreshTokenEncrypted,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "decrypt_failed" }, 500);
      }

      const outcome = await refreshBoxAccessToken({
        refreshToken: refreshTokenPlain,
        clientId: env.BOX_OAUTH_CLIENT_ID,
        clientSecret: env.BOX_OAUTH_CLIENT_SECRET,
      });

      if (outcome.kind === "transient") {
        return jsonResponse(
          { error: "refresh_transient", reason: outcome.reason },
          502,
        );
      }
      if (outcome.kind === "pending_reauth") {
        return jsonResponse(
          { error: "pending_reauth", reason: outcome.reason },
          409,
        );
      }
      if (outcome.kind === "invalid") {
        return jsonResponse(
          { error: "refresh_invalid", reason: outcome.reason },
          502,
        );
      }

      // outcome.kind === 'success'. Box rotates the refresh token — encrypt
      // and persist the NEW refresh_token alongside the new access_token, or
      // the next refresh fails with invalid_grant.
      const newExpiresAt = new Date(outcome.expiresAtMs);
      let newAccessTokenEnc: string;
      let newRefreshTokenEnc: string;
      try {
        newAccessTokenEnc = await encryptToken(
          outcome.accessToken,
          env.BASEOUT_ENCRYPTION_KEY,
        );
        newRefreshTokenEnc = await encryptToken(
          outcome.refreshToken,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "encrypt_failed" }, 500);
      }

      await db
        .update(storageDestinations)
        .set({
          oauthAccessTokenEnc: newAccessTokenEnc,
          oauthRefreshTokenEnc: newRefreshTokenEnc,
          oauthExpiresAt: newExpiresAt,
          oauthScope: outcome.scope ?? sql`${storageDestinations.oauthScope}`,
          lastValidatedAt: new Date(),
        })
        .where(eq(storageDestinations.id, row.id));

      accessTokenPlain = outcome.accessToken;
      expiresAtIso = newExpiresAt.toISOString();
    } else {
      try {
        accessTokenPlain = await decryptToken(
          accessTokenEncrypted,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "decrypt_failed" }, 500);
      }
      expiresAtIso = expiresAt!.toISOString();

      await db
        .update(storageDestinations)
        .set({ lastValidatedAt: new Date() })
        .where(eq(storageDestinations.id, row.id));
    }

    return jsonResponse(
      {
        type: "box",
        accessToken: accessTokenPlain,
        expiresAt: expiresAtIso,
        providerFolderId,
      },
      200,
    );
  }

  if (row.type === "dropbox") {
    let accessTokenPlain: string;
    let expiresAtIso: string;

    if (shouldRefresh) {
      let refreshTokenPlain: string;
      try {
        refreshTokenPlain = await decryptToken(
          refreshTokenEncrypted,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "decrypt_failed" }, 500);
      }

      const outcome = await refreshDropboxAccessToken({
        refreshToken: refreshTokenPlain,
        clientId: env.DROPBOX_OAUTH_CLIENT_ID,
        clientSecret: env.DROPBOX_OAUTH_CLIENT_SECRET,
      });

      if (outcome.kind === "transient") {
        return jsonResponse(
          { error: "refresh_transient", reason: outcome.reason },
          502,
        );
      }
      if (outcome.kind === "pending_reauth") {
        return jsonResponse(
          { error: "pending_reauth", reason: outcome.reason },
          409,
        );
      }
      if (outcome.kind === "invalid") {
        return jsonResponse(
          { error: "refresh_invalid", reason: outcome.reason },
          502,
        );
      }

      // outcome.kind === 'success'. Dropbox refresh tokens are stable; the
      // refresh response omits refresh_token. Persist only the new access
      // token + expiry; preserve the stored oauth_refresh_token_enc.
      const newExpiresAt = new Date(outcome.expiresAtMs);
      let newAccessTokenEnc: string;
      try {
        newAccessTokenEnc = await encryptToken(
          outcome.accessToken,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "encrypt_failed" }, 500);
      }

      await db
        .update(storageDestinations)
        .set({
          oauthAccessTokenEnc: newAccessTokenEnc,
          oauthExpiresAt: newExpiresAt,
          oauthScope: outcome.scope ?? sql`${storageDestinations.oauthScope}`,
          lastValidatedAt: new Date(),
        })
        .where(eq(storageDestinations.id, row.id));

      accessTokenPlain = outcome.accessToken;
      expiresAtIso = newExpiresAt.toISOString();
    } else {
      try {
        accessTokenPlain = await decryptToken(
          accessTokenEncrypted,
          env.BASEOUT_ENCRYPTION_KEY,
        );
      } catch {
        return jsonResponse({ error: "decrypt_failed" }, 500);
      }
      expiresAtIso = expiresAt!.toISOString();

      await db
        .update(storageDestinations)
        .set({ lastValidatedAt: new Date() })
        .where(eq(storageDestinations.id, row.id));
    }

    return jsonResponse(
      {
        type: "dropbox",
        accessToken: accessTokenPlain,
        expiresAt: expiresAtIso,
        providerFolderId,
      },
      200,
    );
  }

  // Unknown type (CHECK constraint should prevent this; defensive).
  return jsonResponse({ error: "unsupported_type" }, 500);
}

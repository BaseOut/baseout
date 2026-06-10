// OAuth-refresh orchestrator (openspec server-cron-oauth-refresh).
//
// Hardened rules (2026-06-05):
//   - Never transition healthy rows to status='invalid' — use pending_reauth.
//   - No status='refreshing' claims (avoids stuck rows + double-refresh races).
//   - 14m modified_at cooldown on active rows (> */15 cron cadence).
//   - 10m access-token lookahead; self-heal pending_reauth after 1m (not invalid — retired dupes).
//   - One row per organization_id per tick (deduped).
//   - On success CAS miss after Airtable rotation: id-only token persist.

import { type AppDb } from "../db/worker";
import { sql } from "drizzle-orm";
import { decryptToken, encryptToken } from "./crypto";
import {
  refreshAirtableAccessToken,
  type RefreshOutcome,
} from "./airtable-refresh";

const SELECT_LIMIT = 100;
const LOOKAHEAD_INTERVAL_SQL = "10 minutes";
const ACTIVE_REFRESH_COOLDOWN_SQL = "14 minutes";
const SELF_HEAL_COOLDOWN_SQL = "1 minute";
const PERSIST_AFTER_ROTATION_ATTEMPTS = 4;
const PERSIST_RETRY_DELAY_MS = 250;

export interface OAuthRefreshTickDeps {
  db: AppDb;
  encryptionKey: string;
  clientId: string;
  clientSecret: string;
  refresh?: typeof refreshAirtableAccessToken;
  nowMs?: () => number;
  log?: (event: OAuthRefreshLogEvent) => void;
}

export interface OAuthRefreshLogEvent {
  event: "oauth_refresh";
  connectionId: string;
  outcome:
    | "success"
    | "pending_reauth"
    | "transient"
    | "claim_skipped"
    | "decrypt_failed"
    | "cas_lost"
    | "persist_after_cas_miss"
    | "unexpected_error";
  latencyMs: number;
  reason?: string;
}

export interface OAuthRefreshTickResult {
  considered: number;
  claimed: number;
  outcomes: Record<OAuthRefreshLogEvent["outcome"], number>;
}

interface SelectedRow {
  id: string;
  organization_id: string;
  status: string;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
  scopes: string | null;
  platform_config: unknown;
}

function emptyOutcomes(): OAuthRefreshTickResult["outcomes"] {
  return {
    success: 0,
    pending_reauth: 0,
    transient: 0,
    claim_skipped: 0,
    decrypt_failed: 0,
    cas_lost: 0,
    persist_after_cas_miss: 0,
    unexpected_error: 0,
  };
}

function dedupeByOrganization(rows: SelectedRow[]): SelectedRow[] {
  const seen = new Set<string>();
  const out: SelectedRow[] = [];
  for (const row of rows) {
    if (seen.has(row.organization_id)) continue;
    seen.add(row.organization_id);
    out.push(row);
  }
  return out;
}

export async function runOAuthRefreshTick(
  deps: OAuthRefreshTickDeps,
): Promise<OAuthRefreshTickResult> {
  const refresh = deps.refresh ?? refreshAirtableAccessToken;
  const nowMs = deps.nowMs ?? Date.now;
  const log = deps.log ?? (() => undefined);
  const outcomes = emptyOutcomes();

  const platformRows = (await deps.db.execute(
    sql`SELECT id FROM baseout.platforms WHERE slug = 'airtable' LIMIT 1`,
  )) as unknown as Array<{ id: string }>;
  const airtablePlatformId = platformRows[0]?.id;
  if (!airtablePlatformId) {
    log({
      event: "oauth_refresh",
      connectionId: "",
      outcome: "unexpected_error",
      latencyMs: 0,
      reason: "airtable_platform_not_seeded",
    });
    return { considered: 0, claimed: 0, outcomes };
  }

  const rawCandidates = (await deps.db.execute(sql`
    SELECT id, organization_id, status, refresh_token_enc, token_expires_at, scopes, platform_config
    FROM baseout.connections
    WHERE platform_id = ${airtablePlatformId}
      AND refresh_token_enc IS NOT NULL
      AND (
        (status = 'active'
          AND modified_at < now() - interval '${sql.raw(ACTIVE_REFRESH_COOLDOWN_SQL)}'
          AND (token_expires_at IS NULL
               OR token_expires_at < now() + interval '${sql.raw(LOOKAHEAD_INTERVAL_SQL)}'))
        OR (status = 'pending_reauth'
          AND modified_at < now() - interval '${sql.raw(SELF_HEAL_COOLDOWN_SQL)}')
      )
    ORDER BY
      CASE status WHEN 'active' THEN 0 ELSE 1 END,
      token_expires_at ASC NULLS FIRST
    LIMIT ${SELECT_LIMIT}
  `)) as unknown as SelectedRow[];

  const candidates = dedupeByOrganization(rawCandidates);
  let claimed = 0;

  for (const row of candidates) {
    const startedAt = nowMs();
    const isSelfHeal = row.status === "pending_reauth";

    const claim = (await deps.db.execute(
      isSelfHeal
        ? sql`
            UPDATE baseout.connections
            SET modified_at = now()
            WHERE id = ${row.id}
              AND status = 'pending_reauth'
              AND modified_at < now() - interval '${sql.raw(SELF_HEAL_COOLDOWN_SQL)}'
            RETURNING id, status, modified_at
          `
        : sql`
            UPDATE baseout.connections
            SET modified_at = now()
            WHERE id = ${row.id}
              AND status = 'active'
              AND modified_at < now() - interval '${sql.raw(ACTIVE_REFRESH_COOLDOWN_SQL)}'
              AND (token_expires_at IS NULL
                   OR token_expires_at < now() + interval '${sql.raw(LOOKAHEAD_INTERVAL_SQL)}')
            RETURNING id, status, modified_at
          `,
    )) as unknown as Array<{ id: string; status: string; modified_at: Date | string }>;

    if (claim.length === 0) {
      outcomes.claim_skipped += 1;
      log({
        event: "oauth_refresh",
        connectionId: row.id,
        outcome: "claim_skipped",
        latencyMs: nowMs() - startedAt,
      });
      continue;
    }

    const claimedAt = claim[0]!.modified_at;
    const priorStatus = claim[0]!.status;
    claimed += 1;

    if (row.refresh_token_enc === null) {
      await revertClaim(deps.db, row.id, priorStatus, claimedAt, isSelfHeal);
      outcomes.decrypt_failed += 1;
      log({
        event: "oauth_refresh",
        connectionId: row.id,
        outcome: "decrypt_failed",
        latencyMs: nowMs() - startedAt,
        reason: "refresh_token_enc_null_after_filter",
      });
      continue;
    }

    let plaintextRefresh: string;
    try {
      plaintextRefresh = await decryptToken(
        row.refresh_token_enc,
        deps.encryptionKey,
      );
    } catch (err) {
      await applyPendingReauth(
        deps.db,
        row.id,
        priorStatus,
        claimedAt,
        err instanceof Error ? err.message : String(err),
      );
      outcomes.decrypt_failed += 1;
      log({
        event: "oauth_refresh",
        connectionId: row.id,
        outcome: "decrypt_failed",
        latencyMs: nowMs() - startedAt,
        reason: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    try {
      const outcome = await refresh({
        refreshToken: plaintextRefresh,
        clientId: deps.clientId,
        clientSecret: deps.clientSecret,
      });

      await applyOutcome(
        deps.db,
        row.id,
        priorStatus,
        claimedAt,
        outcome,
        deps.encryptionKey,
        outcomes,
        (kind, reason) =>
          log({
            event: "oauth_refresh",
            connectionId: row.id,
            outcome: kind,
            latencyMs: nowMs() - startedAt,
            reason,
          }),
      );
    } catch (err) {
      await revertClaim(deps.db, row.id, priorStatus, claimedAt, isSelfHeal);
      outcomes.unexpected_error += 1;
      log({
        event: "oauth_refresh",
        connectionId: row.id,
        outcome: "unexpected_error",
        latencyMs: nowMs() - startedAt,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { considered: candidates.length, claimed, outcomes };
}

async function revertClaim(
  db: AppDb,
  connectionId: string,
  priorStatus: string,
  claimedAt: Date | string,
  selfHeal: boolean,
): Promise<void> {
  const backoff = selfHeal ? SELF_HEAL_COOLDOWN_SQL : ACTIVE_REFRESH_COOLDOWN_SQL;
  await db.execute(sql`
    UPDATE baseout.connections
    SET modified_at = now() - interval '${sql.raw(backoff)}' - interval '1 second'
    WHERE id = ${connectionId}
      AND status = ${priorStatus}
      AND date_trunc('milliseconds', modified_at) = ${claimedAt}
  `);
}

async function applyPendingReauth(
  db: AppDb,
  connectionId: string,
  priorStatus: string,
  claimedAt: Date | string,
  reason: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE baseout.connections
    SET status = 'pending_reauth', modified_at = now()
    WHERE id = ${connectionId}
      AND status = ${priorStatus}
      AND date_trunc('milliseconds', modified_at) = ${claimedAt}
  `);
  void reason;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistRotatedTokens(
  db: AppDb,
  connectionId: string,
  priorStatus: string,
  claimedAt: Date | string,
  newAccessEnc: string,
  newRefreshEnc: string,
  expiresAt: string,
  scope: string | null,
): Promise<"success" | "persist_after_cas_miss" | "failed"> {
  const casWhere = sql`
    id = ${connectionId}
    AND status = ${priorStatus}
    AND date_trunc('milliseconds', modified_at) = ${claimedAt}
  `;

  for (let attempt = 0; attempt < PERSIST_AFTER_ROTATION_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleepMs(PERSIST_RETRY_DELAY_MS * attempt);

    const update = (await db.execute(sql`
      UPDATE baseout.connections
      SET access_token_enc = ${newAccessEnc},
          refresh_token_enc = ${newRefreshEnc},
          token_expires_at = ${expiresAt},
          scopes = ${scope},
          status = 'active',
          invalidated_at = NULL,
          modified_at = now()
      WHERE ${casWhere}
      RETURNING id
    `)) as unknown as Array<{ id: string }>;
    if (update.length > 0) return "success";

    const fallback = (await db.execute(sql`
      UPDATE baseout.connections
      SET access_token_enc = ${newAccessEnc},
          refresh_token_enc = ${newRefreshEnc},
          token_expires_at = ${expiresAt},
          scopes = ${scope},
          status = 'active',
          invalidated_at = NULL,
          modified_at = now()
      WHERE id = ${connectionId}
      RETURNING id
    `)) as unknown as Array<{ id: string }>;
    if (fallback.length > 0) return "persist_after_cas_miss";
  }

  return "failed";
}

async function applyOutcome(
  db: AppDb,
  connectionId: string,
  priorStatus: string,
  claimedAt: Date | string,
  outcome: RefreshOutcome,
  encryptionKey: string,
  outcomes: OAuthRefreshTickResult["outcomes"],
  log: (kind: OAuthRefreshLogEvent["outcome"], reason?: string) => void,
): Promise<void> {
  const casWhere = sql`
    id = ${connectionId}
    AND status = ${priorStatus}
    AND date_trunc('milliseconds', modified_at) = ${claimedAt}
  `;

  switch (outcome.kind) {
    case "success": {
      const newAccessEnc = await encryptToken(outcome.accessToken, encryptionKey);
      const newRefreshEnc = await encryptToken(outcome.refreshToken, encryptionKey);
      const expiresAt = new Date(outcome.expiresAtMs).toISOString();
      const persisted = await persistRotatedTokens(
        db,
        connectionId,
        priorStatus,
        claimedAt,
        newAccessEnc,
        newRefreshEnc,
        expiresAt,
        outcome.scope,
      );
      if (persisted === "success") {
        outcomes.success += 1;
        log("success");
        return;
      }
      if (persisted === "persist_after_cas_miss") {
        outcomes.persist_after_cas_miss += 1;
        log("persist_after_cas_miss");
        return;
      }

      // Airtable rotated the grant but DB never persisted — mark Reconnect now
      // instead of leaving a stale active row that fails on the next tick.
      await applyPendingReauth(
        db,
        connectionId,
        priorStatus,
        claimedAt,
        "persist_failed_after_rotation",
      );
      outcomes.cas_lost += 1;
      log("cas_lost", "persist_failed_after_rotation");
      return;
    }
    case "pending_reauth":
    case "invalid": {
      await db.execute(sql`
        UPDATE baseout.connections
        SET status = 'pending_reauth', modified_at = now()
        WHERE ${casWhere}
      `);
      outcomes.pending_reauth += 1;
      log("pending_reauth", outcome.reason);
      return;
    }
    case "transient": {
      await revertClaim(
        db,
        connectionId,
        priorStatus,
        claimedAt,
        priorStatus === "pending_reauth",
      );
      outcomes.transient += 1;
      log("transient", outcome.reason);
      return;
    }
  }
}

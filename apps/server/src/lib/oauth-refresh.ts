// OAuth-refresh orchestrator (Phase B1 / openspec
// baseout-server-cron-oauth-refresh).
//
// Driven by the Worker's `scheduled` handler on the `*/15 * * * *` cron. One
// tick:
//   1. SELECT connections nearing expiry (Airtable, status='active',
//      refresh_token_enc IS NOT NULL, expires within 20 minutes). LIMIT 100.
//   2. For each row, CAS-claim `status='active' → status='refreshing'`. Skip
//      on 0 rows (concurrent cron tick or fresh OAuth callback overwrote).
//   3. Decrypt refresh_token_enc → call refreshAirtableAccessToken →
//      branch on RefreshOutcome:
//        success         → re-encrypt new tokens, advance expiry, status='active'
//        pending_reauth  → status='pending_reauth'
//        transient       → revert status='active' (next tick retries)
//        invalid         → status='invalid' + invalidated_at=now()
//      All writes CAS-guarded on `WHERE status='refreshing'` so a concurrent
//      apps/web OAuth callback's fresh tokens survive.
//   4. Per-row structured log to console (the shared logger isn't wired in
//      apps/server yet; switching to it is a follow-up).
//
// Public surface is `runOAuthRefreshTick(deps)` — fully dep-injected so the
// scheduled handler wires real Drizzle + Web Crypto + Airtable fetch, and
// the integration test wires fakes.

import { type AppDb } from "../db/worker";
import { sql } from "drizzle-orm";
import { decryptToken, encryptToken } from "./crypto";
import {
  refreshAirtableAccessToken,
  type RefreshOutcome,
} from "./airtable-refresh";

const SELECT_LIMIT = 100;
const LOOKAHEAD_INTERVAL_SQL = "20 minutes";

export interface OAuthRefreshTickDeps {
  db: AppDb;
  encryptionKey: string;
  clientId: string;
  clientSecret: string;
  /** Refresh RPC. Defaults to the real `refreshAirtableAccessToken`. */
  refresh?: typeof refreshAirtableAccessToken;
  /** Override for unit/integration tests. Defaults to Date.now. */
  nowMs?: () => number;
  /** Override for unit/integration tests. */
  log?: (event: OAuthRefreshLogEvent) => void;
}

export interface OAuthRefreshLogEvent {
  event: "oauth_refresh";
  connectionId: string;
  outcome:
    | "success"
    | "pending_reauth"
    | "transient"
    | "invalid"
    | "claim_skipped"
    | "decrypt_failed"
    | "cas_lost"
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
    invalid: 0,
    claim_skipped: 0,
    decrypt_failed: 0,
    cas_lost: 0,
    unexpected_error: 0,
  };
}

export async function runOAuthRefreshTick(
  deps: OAuthRefreshTickDeps,
): Promise<OAuthRefreshTickResult> {
  const refresh = deps.refresh ?? refreshAirtableAccessToken;
  const nowMs = deps.nowMs ?? Date.now;
  const log = deps.log ?? (() => undefined);
  const outcomes = emptyOutcomes();

  // Resolve the Airtable platform_id once per tick. The platforms table is
  // seeded reference data; a stale module-scope cache risks pinning to a
  // stale UUID after a re-seed, so we query per tick — cheap and correct.
  const platformRows = (await deps.db.execute(
    sql`SELECT id FROM baseout.platforms WHERE slug = 'airtable' LIMIT 1`,
  )) as unknown as Array<{ id: string }>;
  const airtablePlatformId = platformRows[0]?.id;
  if (!airtablePlatformId) {
    // Misconfigured environment — log and bail without claiming anything.
    log({
      event: "oauth_refresh",
      connectionId: "",
      outcome: "invalid",
      latencyMs: 0,
      reason: "airtable_platform_not_seeded",
    });
    return { considered: 0, claimed: 0, outcomes };
  }

  // Selection — see openspec design.md §Selection Query and the Phase B2
  // plan (~/.claude/plans/drifting-sprouting-wirth.md). Two arms:
  //
  //   1. status='active' AND (expiry is null OR within 20m lookahead).
  //      The null-or-near predicate recovers connections where
  //      apps/web's persist wrote `token_expires_at = null` because
  //      Airtable's token response was missing `expires_in`. SQL
  //      `NULL < timestamp` is NULL (not TRUE), so the Phase B1 form
  //      silently skipped these rows.
  //
  //   2. status='refreshing' AND modified_at older than 5 minutes.
  //      Reaps rows stranded by an earlier tick's uncaught throw between
  //      CAS-claim and applyOutcome. The 5-minute floor avoids racing a
  //      live tick whose refresh RPC is still in flight (the SDK
  //      handler's 60s timeout + a generous safety margin).
  //
  // NULLS FIRST orders the most-urgent (null-expiry) rows first so a
  // claimed LIMIT bucket prioritizes them when the candidate set is
  // large.
  const candidates = (await deps.db.execute(sql`
    SELECT id, refresh_token_enc, token_expires_at, scopes, platform_config
    FROM baseout.connections
    WHERE platform_id = ${airtablePlatformId}
      AND refresh_token_enc IS NOT NULL
      AND (
        (status = 'active'
          AND (token_expires_at IS NULL
               OR token_expires_at < now() + interval '${sql.raw(LOOKAHEAD_INTERVAL_SQL)}'))
        OR (status = 'refreshing'
          AND modified_at < now() - interval '5 minutes')
      )
    ORDER BY token_expires_at ASC NULLS FIRST
    LIMIT ${SELECT_LIMIT}
  `)) as unknown as SelectedRow[];

  let claimed = 0;

  for (const row of candidates) {
    const startedAt = nowMs();

    // CAS claim — accepts status IN ('active', 'refreshing') so the
    // stuck-reap arm of the selection can re-take ownership of a row
    // stranded by an earlier tick's uncaught throw. Phase B1 required
    // status='active' which silently excluded stuck rows from recovery.
    //
    // Concurrency note: two ticks claiming the same stuck row will both
    // win this CAS and both will call refresh. applyOutcome's
    // `WHERE status='refreshing'` then admits whichever UPDATE lands
    // last. The 5-minute stale-threshold in the selection arm makes this
    // race rare in practice; the trade-off is accepted in exchange for
    // ensuring stuck rows are always reaped.
    const claim = (await deps.db.execute(sql`
      UPDATE baseout.connections
      SET status = 'refreshing', modified_at = now()
      WHERE id = ${row.id} AND status IN ('active', 'refreshing')
      RETURNING id
    `)) as unknown as Array<{ id: string }>;
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
    claimed += 1;

    // Decrypt the stored refresh token. A null here is a precondition
    // violation (the selection filter requires refresh_token_enc IS NOT
    // NULL) — defensively reverts to 'active' if it happens.
    if (row.refresh_token_enc === null) {
      await deps.db.execute(sql`
        UPDATE baseout.connections
        SET status = 'active', modified_at = now()
        WHERE id = ${row.id} AND status = 'refreshing'
      `);
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
      // Cipher tampered with or wrong key. Transition to 'invalid' so the
      // user sees a clean Reconnect prompt rather than a silent rot loop.
      await deps.db.execute(sql`
        UPDATE baseout.connections
        SET status = 'invalid', invalidated_at = now(), modified_at = now()
        WHERE id = ${row.id} AND status = 'refreshing'
      `);
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

    // Wrap refresh + applyOutcome in try/catch (Phase B2). An uncaught
    // throw between CAS-claim and applyOutcome would leave the row
    // stranded at status='refreshing'. Phase B1's selection only matched
    // status='active', so stranded rows were never reaped — producing
    // the every-couple-of-hours disconnect symptom. Now: catch any
    // throw, revert to 'active' so the next tick retries, record an
    // unexpected_error outcome. Do NOT re-throw; the per-row loop must
    // keep going (one bad row doesn't poison the whole tick).
    try {
      const outcome: RefreshOutcome = await refresh({
        refreshToken: plaintextRefresh,
        clientId: deps.clientId,
        clientSecret: deps.clientSecret,
      });

      await applyOutcome(deps.db, row.id, outcome, deps.encryptionKey, outcomes, (kind, reason) =>
        log({
          event: "oauth_refresh",
          connectionId: row.id,
          outcome: kind,
          latencyMs: nowMs() - startedAt,
          reason,
        }),
      );
    } catch (err) {
      await deps.db.execute(sql`
        UPDATE baseout.connections
        SET status = 'active', modified_at = now()
        WHERE id = ${row.id} AND status = 'refreshing'
      `);
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

async function applyOutcome(
  db: AppDb,
  connectionId: string,
  outcome: RefreshOutcome,
  encryptionKey: string,
  outcomes: OAuthRefreshTickResult["outcomes"],
  log: (
    kind: OAuthRefreshLogEvent["outcome"],
    reason?: string,
  ) => void,
): Promise<void> {
  switch (outcome.kind) {
    case "success": {
      const newAccessEnc = await encryptToken(outcome.accessToken, encryptionKey);
      const newRefreshEnc = await encryptToken(outcome.refreshToken, encryptionKey);
      const expiresAt = new Date(outcome.expiresAtMs).toISOString();
      const update = (await db.execute(sql`
        UPDATE baseout.connections
        SET access_token_enc = ${newAccessEnc},
            refresh_token_enc = ${newRefreshEnc},
            token_expires_at = ${expiresAt},
            scopes = ${outcome.scope},
            status = 'active',
            modified_at = now()
        WHERE id = ${connectionId} AND status = 'refreshing'
        RETURNING id
      `)) as unknown as Array<{ id: string }>;
      if (update.length === 0) {
        // apps/web callback overwrote mid-flight. Discard our result —
        // their tokens are fresher.
        outcomes.cas_lost += 1;
        log("cas_lost");
        return;
      }
      outcomes.success += 1;
      log("success");
      return;
    }
    case "pending_reauth": {
      await db.execute(sql`
        UPDATE baseout.connections
        SET status = 'pending_reauth', modified_at = now()
        WHERE id = ${connectionId} AND status = 'refreshing'
      `);
      outcomes.pending_reauth += 1;
      log("pending_reauth", outcome.reason);
      return;
    }
    case "transient": {
      // Revert so the next tick retries.
      await db.execute(sql`
        UPDATE baseout.connections
        SET status = 'active', modified_at = now()
        WHERE id = ${connectionId} AND status = 'refreshing'
      `);
      outcomes.transient += 1;
      log("transient", outcome.reason);
      return;
    }
    case "invalid": {
      await db.execute(sql`
        UPDATE baseout.connections
        SET status = 'invalid', invalidated_at = now(), modified_at = now()
        WHERE id = ${connectionId} AND status = 'refreshing'
      `);
      outcomes.invalid += 1;
      log("invalid", outcome.reason);
      return;
    }
  }
}

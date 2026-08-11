#!/usr/bin/env node
// Bootstrap script — arm a SpaceDO alarm for every existing Space.
//
// Phase B of baseout-backup-schedule-and-cancel. New Spaces' alarms are
// armed by the PATCH /backup-config side effect; pre-existing Spaces
// (every dev environment, plus prod by the time Phase B deploys) have
// nothing armed yet. This script iterates baseout.backup_configurations
// and POSTs to /api/internal/spaces/:spaceId/set-frequency for each
// scheduled cadence (monthly / weekly / daily). Idempotent — re-running
// just re-computes the next-fire timestamp from `now()` and re-sets the
// alarm.
//
// 'instant' frequencies are skipped (webhook-driven, separate change).
//
// Invoked via:
//   node --env-file-if-exists=.env scripts/bootstrap-space-do-alarms.mjs
//
// Required env:
//   DATABASE_URL                  — master DB connection string
//   BACKUP_ENGINE_URL             — base URL of the engine Worker
//                                   (e.g. http://localhost:8787 in dev,
//                                    or the deployed Worker URL in
//                                    staging/production)
//   INTERNAL_TOKEN                — shared secret matching env.INTERNAL_TOKEN
//                                   on the engine
//
// Reads DATABASE_URL via the same `postgres` driver apps/server uses for
// per-request connections.

import postgres from "postgres";

const SCHEDULED_FREQUENCIES = new Set(["monthly", "weekly", "daily"]);

function trimSlash(s) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const engineUrl = process.env.BACKUP_ENGINE_URL;
  const internalToken = process.env.INTERNAL_TOKEN;
  if (!databaseUrl) {
    console.error("bootstrap-space-do-alarms: DATABASE_URL is required");
    process.exit(1);
  }
  if (!engineUrl) {
    console.error("bootstrap-space-do-alarms: BACKUP_ENGINE_URL is required");
    process.exit(1);
  }
  if (!internalToken) {
    console.error("bootstrap-space-do-alarms: INTERNAL_TOKEN is required");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { onnotice: () => {} });
  const base = trimSlash(engineUrl);

  try {
    const rows = await sql`
      SELECT space_id, frequency
      FROM baseout.backup_configurations
      ORDER BY created_at ASC
    `;

    let armed = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      const spaceId = row.space_id;
      const frequency = row.frequency;
      if (!SCHEDULED_FREQUENCIES.has(frequency)) {
        // instant or unknown — out of scope this change.
        // eslint-disable-next-line no-console -- bootstrap script: stdout is the product
        console.log(
          JSON.stringify({
            event: "bootstrap_space_do_skipped",
            spaceId,
            frequency,
            reason: "non_scheduled_frequency",
          }),
        );
        skipped += 1;
        continue;
      }
      const url = `${base}/api/internal/spaces/${encodeURIComponent(
        spaceId,
      )}/set-frequency`;
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "x-internal-token": internalToken,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ frequency }),
        });
      } catch (err) {
        failed += 1;
        // eslint-disable-next-line no-console -- bootstrap script: stdout is the product
        console.log(
          JSON.stringify({
            event: "bootstrap_space_do_failed",
            spaceId,
            frequency,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        continue;
      }
      if (!res.ok) {
        failed += 1;
        // eslint-disable-next-line no-console -- bootstrap script: stdout is the product
        console.log(
          JSON.stringify({
            event: "bootstrap_space_do_failed",
            spaceId,
            frequency,
            status: res.status,
          }),
        );
        continue;
      }
      const body = await res.json();
      armed += 1;
      // eslint-disable-next-line no-console -- bootstrap script: stdout is the product
      console.log(
        JSON.stringify({
          event: "bootstrap_space_do_armed",
          spaceId,
          frequency,
          nextFireMs: body.nextFireMs,
        }),
      );
    }

    // eslint-disable-next-line no-console -- bootstrap script: stdout is the product
    console.log(
      JSON.stringify({
        event: "bootstrap_space_do_done",
        considered: rows.length,
        armed,
        skipped,
        failed,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      event: "bootstrap_space_do_fatal",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});

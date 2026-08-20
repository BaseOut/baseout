// Weekly/monthly report schedule sweep — server-reports task 4.1.
//
// Runs on the hourly cron. Finds enabled weekly/monthly definitions whose
// next_run_at is due, generates each (guarded by one-running-per-definition),
// and advances next_run_at to the next fire. A report scheduled for HH:MM fires
// within the hour. Returns counters for the service_runs log.

import type { AppDb } from "../../db/worker";
import type { Env } from "../../env";
import { generateReport } from "./generate";
import { productionGenerateDeps } from "./deps";
import { computeNextRunAt } from "./cadence";
import { listDueClockDefinitions, setNextRunAt } from "./store";
import type { ReportCadence } from "./types";

export async function runScheduledReportSweep(
  env: Env,
  db: AppDb,
  now: Date = new Date(),
): Promise<{ counts: Record<string, number> }> {
  const due = await listDueClockDefinitions(db, now);
  const deps = productionGenerateDeps(env, db);
  let fired = 0;
  let skipped = 0;

  for (const def of due) {
    const result = await generateReport(
      {
        definitionId: def.id,
        spaceId: def.spaceId,
        trigger: { kind: "scheduled", by: def.name },
        now,
      },
      deps,
    );
    if (result.ok) fired += 1;
    else skipped += 1;

    // Advance next_run_at regardless of fire outcome so a transient failure
    // doesn't wedge the schedule at a permanently-due timestamp.
    const next = computeNextRunAt({
      cadence: def.scheduleCadence as ReportCadence,
      scheduleDay: def.scheduleDay,
      scheduleTime: def.scheduleTime,
      from: now,
    });
    await setNextRunAt(db, def.id, next);
  }

  return { counts: { due: due.length, fired, skipped } };
}

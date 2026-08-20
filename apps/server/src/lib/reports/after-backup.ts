// After-backup event-report hook — server-reports task 4.2.
//
// Called (best-effort) from the run-completion path when a backup run finalizes.
// Fires every enabled event-cadence report in the Space whose cadence matches
// the backup kind (data_backup after a full backup, schema_backup after a schema
// backup). The one-running-per-definition guard debounces a multi-run burst.

import type { AppDb } from "../../db/worker";
import type { Env } from "../../env";
import { generateReport } from "./generate";
import { productionGenerateDeps } from "./deps";
import { eventCadenceForBackupKind } from "./schedule";
import { listEnabledDefinitionsByCadence } from "./store";

export interface FireEventReportsResult {
  fired: number;
  skipped: number;
}

/**
 * Fire event-cadence reports for a finalized backup. Never throws — a hook
 * failure must not turn a recorded completion into a wire error (the caller
 * wraps this in waitUntil + try/catch anyway).
 */
export async function fireEventReports(
  env: Env,
  db: AppDb,
  args: { spaceId: string; backupKind: string },
): Promise<FireEventReportsResult> {
  const cadence = eventCadenceForBackupKind(args.backupKind);
  if (!cadence) return { fired: 0, skipped: 0 };

  const defs = await listEnabledDefinitionsByCadence(db, args.spaceId, cadence);
  if (defs.length === 0) return { fired: 0, skipped: 0 };

  const deps = productionGenerateDeps(env, db);
  let fired = 0;
  let skipped = 0;
  for (const def of defs) {
    const result = await generateReport(
      {
        definitionId: def.id,
        spaceId: args.spaceId,
        trigger: { kind: "scheduled", by: cadence },
        now: new Date(),
      },
      deps,
    );
    if (result.ok) fired += 1;
    else skipped += 1; // already_running / no_definition / error — debounced
  }
  return { fired, skipped };
}

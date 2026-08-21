// Report schedule selection (pure, unit-tested) — server-reports task 4.
//
// Two trigger families:
//   • event cadences (data_backup / schema_backup) fire from the backup-
//     completion hook, keyed on backup_runs.kind;
//   • clock cadences (weekly / monthly) fire from the hourly cron sweep against
//     next_run_at.
// The one-running-per-definition guard (partial-unique index) is the debounce:
// a definition already generating is skipped, so a multi-run burst yields one
// report.

export type ReportEventCadence = "data_backup" | "schema_backup";

/** Map a completed backup's kind to the event cadence it fires (or null). */
export function eventCadenceForBackupKind(kind: string): ReportEventCadence | null {
  if (kind === "full") return "data_backup";
  if (kind === "schema") return "schema_backup";
  return null; // incremental + anything else don't fire event reports
}

export interface CadenceRef {
  id: string;
  spaceId: string;
  scheduleCadence: string | null;
  scheduleEnabled: boolean;
}

/** Enabled definitions whose event cadence matches this backup kind. */
export function reportsToFireAfterBackup(
  defs: readonly CadenceRef[],
  backupKind: string,
): { id: string; spaceId: string }[] {
  const cadence = eventCadenceForBackupKind(backupKind);
  if (!cadence) return [];
  return defs
    .filter((d) => d.scheduleEnabled && d.scheduleCadence === cadence)
    .map((d) => ({ id: d.id, spaceId: d.spaceId }));
}

export interface ClockRef extends CadenceRef {
  nextRunAt: Date | null;
}

/** Enabled weekly/monthly definitions whose next_run_at is due at `now`. */
export function dueClockReports(
  defs: readonly ClockRef[],
  now: Date,
): { id: string; spaceId: string }[] {
  return defs
    .filter(
      (d) =>
        d.scheduleEnabled &&
        (d.scheduleCadence === "weekly" || d.scheduleCadence === "monthly") &&
        d.nextRunAt != null &&
        d.nextRunAt.getTime() <= now.getTime(),
    )
    .map((d) => ({ id: d.id, spaceId: d.spaceId }));
}

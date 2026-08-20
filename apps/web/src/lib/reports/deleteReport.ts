/**
 * The consequence of deleting a report — derived ONCE, read by every surface that asks.
 *
 * Two surfaces delete a report: the list row's ⋯ menu (`ReportsView`) and the report page's ⋯ menu
 * (`ReportDefinitionView`). Writing the sentence in both is the defect P13 named — one rule with
 * hand-written readers is not one source of truth — and it is the defect D06 exists to end, because
 * five dialogs written five times reproduce exactly the per-surface variance the decision rejects.
 * Same reason `lib/restore/request.ts` holds the restore request (P16.3).
 *
 * NOTHING HERE IS ASSERTED. Every number comes off the definition: `runs.length`,
 * `schedule.recipients.length`. A dialog that says "this deletes 3 scheduled reports" from a
 * hardcoded 3 is the asserted-claim shape the last four waves kept shipping. If a fact is absent
 * (no schedule, no runs) the clause is DROPPED, never faked — the same drop-don't-invent rule as
 * `accessLostAt` (P8.5) and `RestoreRequest.workspaceName` (P15).
 *
 * WHY A DIALOG *AND* A TOAST, when `pattern-undo-toast` says to reserve dialogs for what cannot be
 * undone: deleting a report has two halves with different reversibility. The definition itself is
 * restorable inside the undo window — that half takes the toast. The schedule's delivery to people
 * outside Baseout is not: a send that does not happen is not recoverable by putting the row back,
 * and the recipients are never told. The dialog exists for the externally-visible half. A report
 * with NO schedule has no external half at all, and the copy says so instead of implying one.
 */
import type { ReportDefinition } from './types';
import { cadenceLabel } from './view2';

/**
 * The confirm button's label. A CONSTANT rather than a per-report string, and exported so both
 * views take it from here: it is the same verb for every report, and `ReportsView` renders ONE
 * dialog for the whole list, so passing it server-side keeps the module the only writer without
 * making a click handler rewrite a button that also carries an icon.
 */
export const REPORT_DELETE_CONFIRM_LABEL = 'Delete report';

/**
 * There is deliberately NO `title` here. `ReportsView` has one dialog for N rows, so its heading has
 * to be the same question every time ("Delete this report?") and the report's own name lives in the
 * lead; `ReportDefinitionView` asks the identical question for consistency. A field this module
 * returned and neither caller used is exactly where the next drift starts, so it is gone rather
 * than left as a plausible-looking default someone later "fixes" the views to read.
 */
export interface ReportDeletionCopy {
  /** The lead sentence: what is destroyed, with its real counts. */
  lead: string;
  /** The soft-alert consequence: the externally visible half, and what undo can and cannot reach. */
  consequence: string;
  /** Confirm-button label. */
  confirmLabel: string;
  /** Past-tense outcome line for the undo toast (pattern-undo-toast: state the outcome, not the action). */
  toast: string;
}

/** "3 runs" / "1 run" / "no saved runs" — one place, so the two callers cannot disagree. */
function runsPhrase(n: number): string {
  if (n === 0) return 'no saved runs';
  return `${n} saved run${n === 1 ? '' : 's'}`;
}

/** Up to two names, then a count — a dialog is read, not scanned, so a list of eight is a wall. */
function recipientsPhrase(emails: string[]): string {
  if (emails.length === 1) return emails[0];
  if (emails.length === 2) return `${emails[0]} and ${emails[1]}`;
  return `${emails[0]}, ${emails[1]} and ${emails.length - 2} more`;
}

export function describeReportDeletion(def: ReportDefinition): ReportDeletionCopy {
  const runCount = def.runs.length;
  const sched = def.schedule;
  const recipients = sched?.recipients.map((r) => r.email) ?? [];

  const lead =
    runCount === 0
      ? `${def.name} has ${runsPhrase(0)} yet, so nothing generated is lost.`
      : `Deletes ${def.name} and ${runsPhrase(runCount)}. Every document it produced goes with it.`;

  let consequence: string;
  if (!sched || recipients.length === 0) {
    consequence =
      'This report is not on a schedule, so nobody stops receiving anything. Undo is available for a few seconds; after that the definition and its runs are gone for good.';
  } else if (sched.enabled) {
    consequence =
      `Its ${cadenceLabel(sched)} delivery stops. ${recipientsPhrase(recipients)} ` +
      `${recipients.length === 1 ? 'is' : 'are'} not told, and reports already emailed cannot be recalled. ` +
      'Undo is available for a few seconds and puts the report back; it cannot bring back a send that was missed in the meantime.';
  } else {
    consequence =
      `Its ${cadenceLabel(sched)} schedule is already paused, so no delivery stops — but ` +
      `${recipientsPhrase(recipients)} ${recipients.length === 1 ? 'is' : 'are'} removed with it and would have to be added again. ` +
      'Undo is available for a few seconds; after that the definition and its runs are gone for good.';
  }

  return {
    lead,
    consequence,
    confirmLabel: REPORT_DELETE_CONFIRM_LABEL,
    toast: `${def.name} deleted`,
  };
}

// Window math (pure, unit-tested) — server-reports task 2.1.
//
// A report's window is half-open [start, end). Rules (design §Window & cadence):
//   since_last → [previous non-ad-hoc GENERATED run's window_end, now);
//                first run → [first backup's start, now)
//   rolling{days} → [now - days, now)
//   all_time → [first backup, now)
// ad_hoc runs (manual override) and failed runs NEVER advance the chain — that
// is enforced by selectChainAnchor, which only considers runs that advanced it.

import type { ReportWindowKind } from "./types";

/** The subset of a prior run needed to decide whether it advanced the chain. */
export interface PriorRun {
  windowEnd: Date;
  adHoc: boolean;
  generationState: "running" | "generated" | "failed";
}

/**
 * The window_end of the most recent run that advanced the since_last chain:
 * a non-ad-hoc, successfully-generated run. Ad-hoc and failed/running runs are
 * ignored, so an explicit override or a failed generation never creates a
 * silent coverage gap. Returns null when no run has advanced the chain yet.
 */
export function selectChainAnchor(priorRuns: readonly PriorRun[]): Date | null {
  let anchor: Date | null = null;
  for (const run of priorRuns) {
    if (run.adHoc) continue;
    if (run.generationState !== "generated") continue;
    if (anchor === null || run.windowEnd.getTime() > anchor.getTime()) {
      anchor = run.windowEnd;
    }
  }
  return anchor;
}

export interface ReportWindowInput {
  windowKind: ReportWindowKind;
  /** Required (non-null) when windowKind === 'rolling'. */
  windowDays?: number | null;
  now: Date;
  /** From selectChainAnchor — the last chain-advancing run's window_end. */
  chainAnchor: Date | null;
  /** Earliest backup started_at in the report's Base scope, or null. */
  firstBackupStart: Date | null;
}

export interface ComputedWindow {
  start: Date;
  end: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute the half-open window [start, end) for a run. `end` is always `now`.
 * When nothing anchors the start (brand-new Space, no backups), the window
 * collapses to an empty [now, now) so the report renders clean sections rather
 * than throwing.
 */
export function computeWindow(input: ReportWindowInput): ComputedWindow {
  const end = input.now;
  let start: Date;

  switch (input.windowKind) {
    case "since_last":
      start = input.chainAnchor ?? input.firstBackupStart ?? end;
      break;
    case "rolling": {
      if (input.windowDays == null || input.windowDays <= 0) {
        throw new Error(
          "computeWindow: windowDays must be a positive integer for a rolling window",
        );
      }
      start = new Date(end.getTime() - input.windowDays * MS_PER_DAY);
      break;
    }
    case "all_time":
      start = input.firstBackupStart ?? end;
      break;
    default: {
      const exhaustive: never = input.windowKind;
      throw new Error(`computeWindow: unknown window kind ${String(exhaustive)}`);
    }
  }

  // Never emit an inverted window.
  if (start.getTime() > end.getTime()) start = end;
  return { start, end };
}

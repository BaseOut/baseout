// decideDeletions — the pure cleanup decision for one Space's backup runs
// (openspec/changes/server-retention-and-cleanup Phase C.1).
//
// Given a Space's live (non-deleted, terminal) runs + its resolved policy + the
// tier-cap + `now`, partition the runs into keep[] and delete[]. Pure and
// time-injected so it is exhaustively unit-testable. Two passes compose:
//
//   1. Cap pass (safety net) — a trial run older than 7 days, or ANY run older
//      than tierCapDays, is force-deleted regardless of policy. This is why a
//      Business user's "keep everything" Custom policy still prunes at the
//      24-month ceiling.
//   2. Policy pass — the per-tier Features §6.9 ladder decides the survivors.
//
// A run is KEEP only if both passes keep it; it is DELETE if either pass drops
// it. The caller (buildCleanupPlan) is responsible for pre-filtering to
// terminal, non-deleted runs.

import type { RetentionPolicyValues } from "./types";

export interface RetentionRun {
  id: string;
  startedAt: Date;
  isTrial: boolean;
}

export interface Decision {
  keep: string[];
  delete: string[];
}

const DAY_MS = 86_400_000;
const TRIAL_CAP_DAYS = 7;

// Custom policy with no explicit rules falls back to this three-tier shape.
const CUSTOM_DEFAULT = {
  dailyWindowDays: 30,
  weeklyWindowDays: 120,
  monthlyIndefinite: true,
} as const;

function ageDays(now: Date, startedAt: Date): number {
  return (now.getTime() - startedAt.getTime()) / DAY_MS;
}

/** 7-day bucket anchored at the Unix epoch. Groups runs into weekly buckets for
 *  the "keep one per week" pass. Not strictly ISO-8601 week-aligned, but a
 *  deterministic weekly partition is all the policy needs. */
function weekKey(d: Date): number {
  return Math.floor(d.getTime() / (7 * DAY_MS));
}

/** Calendar-month bucket (UTC) for the "keep one per month" pass. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

/**
 * Apply a windowed policy (time_based / two_tier / three_tier / custom) to the
 * survivors of the cap pass. `runs` is sorted newest-first. Returns the ids to
 * KEEP; everything else among `runs` is deleted by the policy.
 */
function keepByWindows(
  runs: RetentionRun[],
  now: Date,
  dailyWindowDays: number,
  weeklyWindowDays: number | null,
  monthlyIndefinite: boolean,
): Set<string> {
  const keep = new Set<string>();
  const seenWeeks = new Set<number>();
  const seenMonths = new Set<string>();

  for (const r of runs) {
    const age = ageDays(now, r.startedAt);
    if (age <= dailyWindowDays) {
      // Daily window — keep every snapshot.
      keep.add(r.id);
      continue;
    }
    if (weeklyWindowDays !== null && age <= weeklyWindowDays) {
      // Weekly window — keep the most-recent (first seen, since sorted DESC)
      // run per weekly bucket.
      const wk = weekKey(r.startedAt);
      if (!seenWeeks.has(wk)) {
        seenWeeks.add(wk);
        keep.add(r.id);
      }
      continue;
    }
    // Beyond the weekly window.
    if (monthlyIndefinite) {
      const mk = monthKey(r.startedAt);
      if (!seenMonths.has(mk)) {
        seenMonths.add(mk);
        keep.add(r.id);
      }
    }
    // else: drop (not added to keep).
  }
  return keep;
}

export function decideDeletions(
  runs: RetentionRun[],
  policy: RetentionPolicyValues,
  tierCapDays: number,
  now: Date,
): Decision {
  // Sort a copy newest-first so the policy passes are deterministic regardless
  // of caller ordering.
  const sorted = [...runs].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );

  // 1. Cap pass — force-delete trial-expired + tier-cap-expired runs.
  const forcedDelete = new Set<string>();
  const survivors: RetentionRun[] = [];
  for (const r of sorted) {
    const age = ageDays(now, r.startedAt);
    if (r.isTrial && age > TRIAL_CAP_DAYS) {
      forcedDelete.add(r.id);
      continue;
    }
    if (age > tierCapDays) {
      forcedDelete.add(r.id);
      continue;
    }
    survivors.push(r);
  }

  // 2. Policy pass over the survivors.
  let policyKeep: Set<string>;
  switch (policy.tier) {
    case "basic": {
      const n = policy.keepLastN ?? 0;
      policyKeep = new Set(survivors.slice(0, n).map((r) => r.id));
      break;
    }
    case "time_based": {
      policyKeep = keepByWindows(
        survivors,
        now,
        policy.dailyWindowDays ?? 0,
        null,
        false,
      );
      break;
    }
    case "two_tier": {
      policyKeep = keepByWindows(
        survivors,
        now,
        policy.dailyWindowDays ?? 0,
        policy.weeklyWindowDays ?? null,
        false,
      );
      break;
    }
    case "three_tier": {
      policyKeep = keepByWindows(
        survivors,
        now,
        policy.dailyWindowDays ?? 0,
        policy.weeklyWindowDays ?? null,
        policy.monthlyIndefinite ?? false,
      );
      break;
    }
    case "custom": {
      // First pass: no rules engine yet — dispatch to the three-tier default.
      policyKeep = keepByWindows(
        survivors,
        now,
        CUSTOM_DEFAULT.dailyWindowDays,
        CUSTOM_DEFAULT.weeklyWindowDays,
        CUSTOM_DEFAULT.monthlyIndefinite,
      );
      break;
    }
  }

  const keep: string[] = [];
  const del: string[] = [];
  for (const r of sorted) {
    if (forcedDelete.has(r.id)) del.push(r.id);
    else if (policyKeep.has(r.id)) keep.push(r.id);
    else del.push(r.id);
  }
  return { keep, delete: del };
}

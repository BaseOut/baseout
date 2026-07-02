// Pure-function tests for decideDeletions (server-retention-and-cleanup Phase C.1).
//
// decideDeletions is the heart of the cleanup engine: given a Space's live
// (non-deleted, terminal) backup runs + its resolved policy + the tier-cap +
// `now`, it partitions the runs into keep[] and delete[]. Time is dep-injected
// so every case is deterministic. Two passes compose:
//   1. cap pass — trial runs > 7d and any run > tierCapDays are force-deleted.
//   2. policy pass — the per-tier ladder decides the rest.
// A run is KEEP only if both passes keep it.

import { describe, expect, it } from "vitest";
import {
  decideDeletions,
  type RetentionRun,
} from "../../../src/lib/retention/decide-deletions";
import type { RetentionPolicyValues } from "../../../src/lib/retention/types";

const NOW = new Date("2026-06-27T00:00:00.000Z");
const DAY_MS = 86_400_000;

/** Build a run started `ageDays` before NOW (fractional days allowed). */
function run(id: string, ageDays: number, isTrial = false): RetentionRun {
  return {
    id,
    startedAt: new Date(NOW.getTime() - ageDays * DAY_MS),
    isTrial,
  };
}

/** Sorted id arrays so assertions are order-independent. */
function decide(runs: RetentionRun[], policy: RetentionPolicyValues, cap: number) {
  const r = decideDeletions(runs, policy, cap, NOW);
  return { keep: [...r.keep].sort(), delete: [...r.delete].sort() };
}

describe("decideDeletions — basic policy", () => {
  it("keeps the newest N, deletes the rest", () => {
    const runs = [
      run("a", 1),
      run("b", 2),
      run("c", 3),
      run("d", 4),
      run("e", 5),
    ];
    const policy: RetentionPolicyValues = { tier: "basic", keepLastN: 3 };
    const out = decide(runs, policy, 30);
    expect(out.keep).toEqual(["a", "b", "c"]);
    expect(out.delete).toEqual(["d", "e"]);
  });

  it("keeps everything when keepLastN exceeds the run count", () => {
    const runs = [run("a", 1), run("b", 2), run("c", 3)];
    const policy: RetentionPolicyValues = { tier: "basic", keepLastN: 10 };
    const out = decide(runs, policy, 30);
    expect(out.keep).toEqual(["a", "b", "c"]);
    expect(out.delete).toEqual([]);
  });
});

describe("decideDeletions — time_based policy", () => {
  it("keeps runs within the daily window (boundary inclusive), deletes older", () => {
    const runs = [run("young", 29), run("edge", 30), run("old", 31)];
    const policy: RetentionPolicyValues = { tier: "time_based", dailyWindowDays: 30 };
    const out = decide(runs, policy, 90);
    expect(out.keep).toEqual(["edge", "young"]);
    expect(out.delete).toEqual(["old"]);
  });
});

describe("decideDeletions — two_tier policy", () => {
  it("keeps the daily window, thins the weekly window to one per week, drops beyond", () => {
    const runs = [
      run("daily", 3), // within daily window → keep
      run("wk1", 10), // weekly window, distinct week → keep
      run("wk2", 20), // weekly window, distinct week → keep
      run("wk3a", 40), // weekly window
      run("wk3b", 40.5), // same week as wk3a (12h apart) → drop, keep newer
      run("beyond", 130), // past weekly window (120) → delete
    ];
    const policy: RetentionPolicyValues = {
      tier: "two_tier",
      dailyWindowDays: 7,
      weeklyWindowDays: 120,
    };
    const out = decide(runs, policy, 180);
    expect(out.keep).toEqual(["daily", "wk1", "wk2", "wk3a"]);
    expect(out.delete).toEqual(["beyond", "wk3b"]);
  });
});

describe("decideDeletions — three_tier policy", () => {
  it("keeps monthly snapshots indefinitely (one per calendar month) when enabled", () => {
    const runs = [
      run("daily", 5), // daily window → keep
      run("weekly", 20), // weekly window (8..30) → keep
      run("mApr1", 60), // 2026-04 → keep (newest in month)
      run("mApr2", 65), // 2026-04 → drop (older in same month)
      run("mDec", 200), // 2025-12 → keep
    ];
    const policy: RetentionPolicyValues = {
      tier: "three_tier",
      dailyWindowDays: 7,
      weeklyWindowDays: 30,
      monthlyIndefinite: true,
    };
    const out = decide(runs, policy, Number.POSITIVE_INFINITY);
    expect(out.keep).toEqual(["daily", "mApr1", "mDec", "weekly"]);
    expect(out.delete).toEqual(["mApr2"]);
  });

  it("deletes everything past the weekly window when monthlyIndefinite is false", () => {
    const runs = [
      run("daily", 5),
      run("weekly", 20),
      run("m1", 60),
      run("m2", 200),
    ];
    const policy: RetentionPolicyValues = {
      tier: "three_tier",
      dailyWindowDays: 7,
      weeklyWindowDays: 30,
      monthlyIndefinite: false,
    };
    const out = decide(runs, policy, 365);
    expect(out.keep).toEqual(["daily", "weekly"]);
    expect(out.delete).toEqual(["m1", "m2"]);
  });
});

describe("decideDeletions — custom policy", () => {
  it("falls back to the three-tier default (daily 30 / weekly 120 / monthly indefinite) with no rules", () => {
    const runs = [
      run("daily", 10), // < 30 → keep
      run("mDec", 200), // > 120 weekly → monthly, 2025-12 → keep
      run("mMay1", 400), // 2025-05 → keep (newest in month)
      run("mMay2", 405), // 2025-05 → drop
    ];
    const policy: RetentionPolicyValues = { tier: "custom", customRules: null };
    const out = decide(runs, policy, Number.POSITIVE_INFINITY);
    expect(out.keep).toEqual(["daily", "mDec", "mMay1"]);
    expect(out.delete).toEqual(["mMay2"]);
  });
});

describe("decideDeletions — safety-net caps override policy", () => {
  it("tier-cap force-deletes runs older than the cap even if the policy would keep them", () => {
    const runs = [run("fresh", 10), run("stale", 40)];
    // basic keepLastN=100 would keep both; tier-cap = 30d forces the 40d run out.
    const policy: RetentionPolicyValues = { tier: "basic", keepLastN: 100 };
    const out = decide(runs, policy, 30);
    expect(out.keep).toEqual(["fresh"]);
    expect(out.delete).toEqual(["stale"]);
  });

  it("trial runs are capped at 7 days regardless of policy or tier-cap", () => {
    const runs = [run("t-young", 6, true), run("t-old", 8, true)];
    // basic keepLastN=100 + 30d tier-cap would keep both; trial cap deletes the 8d run.
    const policy: RetentionPolicyValues = { tier: "basic", keepLastN: 100 };
    const out = decide(runs, policy, 30);
    expect(out.keep).toEqual(["t-young"]);
    expect(out.delete).toEqual(["t-old"]);
  });
});

describe("decideDeletions — invariants (fuzz)", () => {
  it("keep ∪ delete = all runs, keep ∩ delete = ∅, caps always honored", () => {
    // Deterministic pseudo-random generator (no Math.random — banned in workflows;
    // keep server tests hermetic too). Linear congruential.
    let seed = 0x1234_5678;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff;
      return seed / 0x7fff_ffff;
    };
    const policies: RetentionPolicyValues[] = [
      { tier: "basic", keepLastN: 5 },
      { tier: "time_based", dailyWindowDays: 30 },
      { tier: "two_tier", dailyWindowDays: 14, weeklyWindowDays: 90 },
      { tier: "three_tier", dailyWindowDays: 7, weeklyWindowDays: 60, monthlyIndefinite: true },
      { tier: "custom", customRules: null },
    ];
    for (let iter = 0; iter < 50; iter++) {
      const policy = policies[Math.floor(rand() * policies.length)]!;
      const cap = [30, 90, 180, 365, Number.POSITIVE_INFINITY][Math.floor(rand() * 5)]!;
      const runs: RetentionRun[] = [];
      for (let i = 0; i < 200; i++) {
        const ageDays = rand() * 730; // up to 2 years
        runs.push(run(`r${iter}-${i}`, ageDays, rand() < 0.1));
      }
      const out = decideDeletions(runs, policy, cap, NOW);
      const all = new Set(runs.map((r) => r.id));
      const keepSet = new Set(out.keep);
      const delSet = new Set(out.delete);
      // partition
      expect(out.keep.length + out.delete.length).toBe(runs.length);
      for (const id of keepSet) expect(delSet.has(id)).toBe(false);
      expect(new Set([...keepSet, ...delSet]).size).toBe(all.size);
      // caps honored
      for (const r of runs) {
        const ageDays = (NOW.getTime() - r.startedAt.getTime()) / DAY_MS;
        if (r.isTrial && ageDays > 7) expect(delSet.has(r.id)).toBe(true);
        if (ageDays > cap) expect(delSet.has(r.id)).toBe(true);
      }
    }
  });
});

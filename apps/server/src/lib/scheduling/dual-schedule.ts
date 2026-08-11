// Dual (data + schema) schedule decision logic (openspec/changes/server-backup-scope).
//
// A Space can run two cadences — a DATA schedule (`backup_configurations.frequency`,
// kind 'full') and an optional more-frequent SCHEMA schedule
// (`schema_frequency`, kind 'schema'). The SpaceDO has a single alarm, so it
// stores both next-fire timestamps and uses these pure functions to decide what
// to fire and when to re-arm. No side effects; the DO injects `now`.

import { computeNextFire, type ScheduledFrequency } from "./next-fire";

export type BackupScope = "schema_only" | "schema_and_data";
export type RunKind = "full" | "schema";

export interface ScheduleConfig {
  scope: BackupScope;
  /** The data/full cadence (`backup_configurations.frequency`). */
  dataFrequency: ScheduledFrequency | null;
  /** The optional schema-only cadence (`backup_configurations.schema_frequency`). */
  schemaFrequency: ScheduledFrequency | null;
}

export interface ScheduleFires {
  /** Next data (full) fire in unix-ms, or null when no data schedule is active. */
  dataNextFire: number | null;
  /** Next schema fire in unix-ms, or null when no schema schedule is active. */
  schemaNextFire: number | null;
}

/** `instant` is webhook-driven (out of scope for scheduled fires), like next-fire.ts. */
function fireFor(frequency: ScheduledFrequency | null, now: Date): number | null {
  if (frequency == null || frequency === "instant") return null;
  return computeNextFire(frequency, now);
}

/**
 * Compute both schedules' next-fire timestamps from a Space's config.
 *
 * - The data schedule only runs when `scope === 'schema_and_data'`.
 * - The schema schedule runs in either scope when `schemaFrequency` is set
 *   (it's the sole schedule under `schema_only`, the optional extra under
 *   `schema_and_data`).
 */
export function computeScheduleFires(cfg: ScheduleConfig, now: Date): ScheduleFires {
  const dataNextFire =
    cfg.scope === "schema_and_data" ? fireFor(cfg.dataFrequency, now) : null;
  const schemaNextFire = fireFor(cfg.schemaFrequency, now);
  return { dataNextFire, schemaNextFire };
}

/**
 * Which run kinds are due at `nowMs` — a schedule fires when its stored
 * next-fire is at or before now. Both can fire at a shared boundary.
 */
export function dueKinds(fires: ScheduleFires, nowMs: number): RunKind[] {
  const kinds: RunKind[] = [];
  if (fires.dataNextFire != null && fires.dataNextFire <= nowMs) kinds.push("full");
  if (fires.schemaNextFire != null && fires.schemaNextFire <= nowMs) kinds.push("schema");
  return kinds;
}

/** The next alarm to arm — the nearer of the two fires, or null if neither is scheduled. */
export function nextAlarm(fires: ScheduleFires): number | null {
  const candidates = [fires.dataNextFire, fires.schemaNextFire].filter(
    (t): t is number => t != null,
  );
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

const KNOWN_FREQUENCIES = new Set<ScheduledFrequency>([
  "monthly",
  "weekly",
  "daily",
  "instant",
]);

/**
 * Coerce a stored cadence string (from `backup_configurations`) to a
 * `ScheduledFrequency`, or null if absent/unknown. `computeScheduleFires`
 * already treats `instant` as unscheduled.
 */
export function asScheduledFrequency(
  value: string | null | undefined,
): ScheduledFrequency | null {
  return typeof value === "string" && KNOWN_FREQUENCIES.has(value as ScheduledFrequency)
    ? (value as ScheduledFrequency)
    : null;
}

// Cadences a schedule can actually be armed with. `instant` is webhook-driven,
// not a scheduled cadence, so set-schedule rejects it (matching the pre-dual
// set-frequency route).
const SCHEDULABLE = new Set<ScheduledFrequency>(["monthly", "weekly", "daily"]);

function coerceSchedulable(
  value: unknown,
): { ok: true; value: ScheduledFrequency | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value === "string" && SCHEDULABLE.has(value as ScheduledFrequency)) {
    return { ok: true, value: value as ScheduledFrequency };
  }
  return { ok: false };
}

/**
 * Parse a set-schedule request body into a `ScheduleConfig`, or null if invalid.
 * Accepts the new `{ scope, dataFrequency?, schemaFrequency? }` shape and the
 * legacy `{ frequency }` shape (treated as a `schema_and_data` data schedule).
 * Rejects unknown / `instant` cadences and an unknown scope.
 */
export function parseScheduleBody(body: unknown): ScheduleConfig | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  // Legacy { frequency } (no scope).
  if (b.scope === undefined && "frequency" in b) {
    const f = coerceSchedulable(b.frequency);
    if (!f.ok || f.value === null) return null;
    return { scope: "schema_and_data", dataFrequency: f.value, schemaFrequency: null };
  }

  // New { scope, dataFrequency?, schemaFrequency? }.
  if (b.scope === "schema_only" || b.scope === "schema_and_data") {
    const d = coerceSchedulable(b.dataFrequency);
    const s = coerceSchedulable(b.schemaFrequency);
    if (!d.ok || !s.ok) return null;
    return { scope: b.scope, dataFrequency: d.value, schemaFrequency: s.value };
  }

  return null;
}

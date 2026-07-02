// SpaceDO — per-Space scheduler.
//
// Dispatches a Space's backup schedule(s) from a single Durable Object alarm.
// server-backup-scope extends the original single-cadence design
// (server-schedule-and-cancel Phase B) to multiplex TWO cadences — a DATA
// (full) schedule and an optional more-frequent SCHEMA schedule — onto the one
// alarm. The DO stores both next-fire timestamps, fires whichever are due, and
// re-arms for the nearer remaining fire. The state-machine + WebSocket fan-out
// (PRD §5 / §10) remain deferred — polling covers live status for MVP.
//
// Two surfaces:
//   - POST /set-frequency : called by apps/web's PATCH backup-config (via an
//     engine proxy route) when the schedule/scope changes. Accepts the new
//     { scope, dataFrequency, schemaFrequency } body and the legacy
//     { frequency } shape. Computes both next-fires, stores them, arms the
//     alarm for the nearer, and returns { ok, dataNextFire, schemaNextFire }.
//   - alarm()             : on the scheduled tick, reads the stored fires +
//     the Space's config, inserts a backup_runs row per due kind (stamping
//     kind), drives processRunStart, recomputes the fired schedule(s), re-arms,
//     and writes next_scheduled_at + schema_next_scheduled_at.
//
// All side effects flow through SpaceDOAlarmDeps; productionDeps(env) wires the
// real DB/processRunStart, tests inject vi.fn() shapes.

import { and, desc, eq } from "drizzle-orm";
import { createMasterDb } from "../db/worker";
import {
  backupConfigurations,
  backupRuns,
  connections,
  platforms,
  spaces,
} from "../db/schema";
import { processRunStart } from "../lib/runs/start";
import { buildRunStartDeps } from "../lib/runs/start-deps";
import {
  asScheduledFrequency,
  computeScheduleFires,
  dueKinds,
  nextAlarm,
  parseScheduleBody,
  type RunKind,
  type ScheduleConfig,
  type ScheduleFires,
} from "../lib/scheduling/dual-schedule";
import type { Env } from "../env";

// DO storage key for the two next-fire timestamps.
const FIRES_KEY = "schedule_fires";

interface SpaceLike {
  id: string;
  organizationId: string;
}

interface ConnectionLike {
  id: string;
  status: string;
}

interface ConfigLike {
  id: string;
  scope: string;
  /** `backup_configurations.frequency` — the data (full) cadence. */
  dataFrequency: string | null;
  schemaFrequency: string | null;
}

export interface SpaceDOAlarmDeps {
  now: () => Date;
  fetchConfig: (spaceId: string) => Promise<ConfigLike | null>;
  fetchSpace: (spaceId: string) => Promise<SpaceLike | null>;
  fetchActiveAirtableConnection: (
    organizationId: string,
  ) => Promise<ConnectionLike | null>;
  insertScheduledRun: (input: {
    spaceId: string;
    connectionId: string;
    kind: RunKind;
  }) => Promise<string>;
  deleteRun: (runId: string) => Promise<void>;
  runStart: (runId: string) => Promise<{ ok: boolean; code?: string }>;
  updateNextScheduled: (configId: string, fires: ScheduleFires) => Promise<void>;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function configToScheduleConfig(config: ConfigLike): ScheduleConfig {
  return {
    scope: config.scope === "schema_only" ? "schema_only" : "schema_and_data",
    dataFrequency: asScheduledFrequency(config.dataFrequency),
    schemaFrequency: asScheduledFrequency(config.schemaFrequency),
  };
}

export class SpaceDO {
  private deps: SpaceDOAlarmDeps | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  // Test-only seam — production never calls this; productionDeps() runs
  // lazily on the first alarm-fire / set-schedule.
  setSchedulerDepsForTests(deps: SpaceDOAlarmDeps): void {
    this.deps = deps;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/set-frequency") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
      }
      return this.handleSetSchedule(request);
    }

    return jsonResponse({ error: "not_found" }, 404);
  }

  async alarm(): Promise<void> {
    const deps = this.getDeps();
    const spaceId = this.spaceId();
    const config = await deps.fetchConfig(spaceId);

    // Config gone (Space deleted, backup-config row removed): stop firing.
    // Re-setting the schedule from apps/web re-arms the loop.
    if (!config) return;

    const now = deps.now();
    const nowMs = now.getTime();
    const scheduleConfig = configToScheduleConfig(config);

    // Read the stored fires. A DO armed before dual-schedule landed has none;
    // it only ever had a single data schedule, so treat this tick as the data
    // schedule firing now (when the config still describes a runnable data
    // schedule). The re-arm below stores fires so later ticks use real values.
    let fires = (await this.state.storage.get<ScheduleFires>(FIRES_KEY)) ?? null;
    if (!fires) {
      const dataRunnable =
        scheduleConfig.scope === "schema_and_data" &&
        scheduleConfig.dataFrequency != null &&
        scheduleConfig.dataFrequency !== "instant";
      fires = { dataNextFire: dataRunnable ? nowMs : null, schemaNextFire: null };
    }

    const kinds = dueKinds(fires, nowMs);

    if (kinds.length > 0) {
      const space = await deps.fetchSpace(spaceId);
      if (space) {
        const connection = await deps.fetchActiveAirtableConnection(
          space.organizationId,
        );
        // Skip the fire when there's no active connection, but STILL advance +
        // re-arm below so the schedule keeps firing once the user reconnects.
        if (connection && connection.status === "active") {
          for (const kind of kinds) {
            const runId = await deps.insertScheduledRun({
              spaceId,
              connectionId: connection.id,
              kind,
            });
            const result = await deps.runStart(runId);
            if (!result.ok) {
              // Roll back the orphaned queued row — mirrors the apps/web POST
              // /backup-runs failure path.
              await deps.deleteRun(runId);
            }
          }
        }
      }
    }

    // Advance the schedule(s) that fired; keep the un-fired one's stored fire.
    const recomputed = computeScheduleFires(scheduleConfig, now);
    const nextFires: ScheduleFires = {
      dataNextFire: kinds.includes("full")
        ? recomputed.dataNextFire
        : fires.dataNextFire,
      schemaNextFire: kinds.includes("schema")
        ? recomputed.schemaNextFire
        : fires.schemaNextFire,
    };

    await this.state.storage.put(FIRES_KEY, nextFires);
    const next = nextAlarm(nextFires);
    if (next != null) {
      await this.state.storage.setAlarm(next);
    } else {
      await this.state.storage.deleteAlarm();
    }
    await deps.updateNextScheduled(config.id, nextFires);
  }

  private async handleSetSchedule(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const parsed = parseScheduleBody(body);
    if (!parsed) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const deps = this.getDeps();
    const fires = computeScheduleFires(parsed, deps.now());
    await this.state.storage.put(FIRES_KEY, fires);
    const next = nextAlarm(fires);
    if (next != null) {
      await this.state.storage.setAlarm(next);
    } else {
      await this.state.storage.deleteAlarm();
    }
    return jsonResponse(
      {
        ok: true,
        dataNextFire: fires.dataNextFire,
        schemaNextFire: fires.schemaNextFire,
      },
      200,
    );
  }

  private getDeps(): SpaceDOAlarmDeps {
    if (!this.deps) {
      this.deps = productionDeps(this.env);
    }
    return this.deps;
  }

  private spaceId(): string {
    // DOs are addressed by `idFromName(spaceId)` from the engine proxy route.
    // `state.id.name` echoes that name back; a missing name means someone used
    // idFromString — fail loudly rather than mis-schedule.
    const name = this.state.id.name;
    if (!name) {
      throw new Error(
        "SpaceDO: missing state.id.name — DO must be addressed via idFromName(spaceId)",
      );
    }
    return name;
  }
}

function productionDeps(env: Env): SpaceDOAlarmDeps {
  return {
    now: () => new Date(),
    fetchConfig: async (spaceId) => {
      const { db, sql } = createMasterDb(env);
      try {
        const rows = await db
          .select({
            id: backupConfigurations.id,
            scope: backupConfigurations.scope,
            dataFrequency: backupConfigurations.frequency,
            schemaFrequency: backupConfigurations.schemaFrequency,
          })
          .from(backupConfigurations)
          .where(eq(backupConfigurations.spaceId, spaceId))
          .limit(1);
        return rows[0] ?? null;
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    fetchSpace: async (spaceId) => {
      const { db, sql } = createMasterDb(env);
      try {
        const rows = await db
          .select({ id: spaces.id, organizationId: spaces.organizationId })
          .from(spaces)
          .where(eq(spaces.id, spaceId))
          .limit(1);
        return rows[0] ?? null;
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    fetchActiveAirtableConnection: async (organizationId) => {
      const { db, sql } = createMasterDb(env);
      try {
        const rows = await db
          .select({
            id: connections.id,
            status: connections.status,
          })
          .from(connections)
          .innerJoin(platforms, eq(platforms.id, connections.platformId))
          .where(
            and(
              eq(connections.organizationId, organizationId),
              eq(platforms.slug, "airtable"),
            ),
          )
          .orderBy(desc(connections.createdAt))
          .limit(1);
        return rows[0] ?? null;
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    insertScheduledRun: async ({ spaceId, connectionId, kind }) => {
      const { db, sql } = createMasterDb(env);
      try {
        const [row] = await db
          .insert(backupRuns)
          .values({
            spaceId,
            connectionId,
            status: "queued",
            triggeredBy: "scheduled",
            kind,
            isTrial: false,
          })
          .returning({ id: backupRuns.id });
        if (!row) throw new Error("insert_scheduled_run_returned_no_row");
        return row.id;
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    deleteRun: async (runId) => {
      const { db, sql } = createMasterDb(env);
      try {
        await db.delete(backupRuns).where(eq(backupRuns.id, runId));
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    runStart: async (runId) => {
      const { db, sql } = createMasterDb(env);
      try {
        const result = await processRunStart(
          { runId },
          buildRunStartDeps(db, env),
        );
        return result.ok ? { ok: true } : { ok: false, code: result.error };
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    updateNextScheduled: async (configId, fires) => {
      const { db, sql } = createMasterDb(env);
      try {
        await db
          .update(backupConfigurations)
          .set({
            nextScheduledAt:
              fires.dataNextFire != null ? new Date(fires.dataNextFire) : null,
            schemaNextScheduledAt:
              fires.schemaNextFire != null
                ? new Date(fires.schemaNextFire)
                : null,
          })
          .where(eq(backupConfigurations.id, configId));
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
  };
}

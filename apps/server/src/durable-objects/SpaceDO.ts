// SpaceDO — per-Space scheduler.
//
// Phase B of baseout-backup-schedule-and-cancel activates the alarm-driven
// dispatch half of the DO's responsibilities. The state-machine + WebSocket
// fan-out (PRD §5 / §10) remain deferred — the current polling-based
// live-status path is good enough for MVP per the
// baseout-backup-history-live-status change.
//
// Two surfaces:
//   - POST /set-frequency : called by apps/web's PATCH backup-config when
//     frequency changes (forwarded through an engine proxy route). Reads
//     the body, validates the frequency, computes the next fire timestamp
//     via the Phase B.2 pure function, and asks the DO runtime to schedule
//     an alarm. Returns { ok: true, nextFireMs }.
//   - alarm()             : runs on the Cloudflare-scheduled alarm tick.
//     Pulls the Space's config, INSERTs a 'queued' backup_runs row with
//     triggered_by='scheduled', drives processRunStart to fan out per-base
//     Trigger.dev tasks, then computes + re-sets the alarm for the next
//     cadence boundary and writes backup_configurations.next_scheduled_at.
//
// All side effects (DB queries, processRunStart) flow through the
// `SpaceDOAlarmDeps` interface. Production wires this via
// `productionDeps(env)` below; tests inject vi.fn() shapes via
// `setSchedulerDepsForTests` (see tests/integration/space-do.test.ts).

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
  computeNextFire,
  type ScheduledFrequency,
} from "../lib/scheduling/next-fire";
import type { Env } from "../env";

const VALID_SCHEDULED_FREQUENCIES = new Set<ScheduledFrequency>([
  "monthly",
  "weekly",
  "daily",
]);

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
  frequency: string;
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
  }) => Promise<string>;
  deleteRun: (runId: string) => Promise<void>;
  runStart: (runId: string) => Promise<{ ok: boolean; code?: string }>;
  updateNextScheduledAt: (configId: string, nextFireMs: number) => Promise<void>;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export class SpaceDO {
  private deps: SpaceDOAlarmDeps | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  // Test-only seam — production never calls this; productionDeps() runs
  // lazily on the first alarm-fire / setFrequency. Same shape as
  // ConnectionDO.setDecryptImplForTests.
  setSchedulerDepsForTests(deps: SpaceDOAlarmDeps): void {
    this.deps = deps;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/set-frequency") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
      }
      return this.handleSetFrequency(request);
    }

    return jsonResponse({ error: "not_found" }, 404);
  }

  async alarm(): Promise<void> {
    const deps = this.getDeps();
    const spaceId = this.spaceId();
    const config = await deps.fetchConfig(spaceId);

    // Config gone (Space deleted, backup-config row removed): stop firing.
    // The DO state survives but the alarm chain dies here — re-setting
    // frequency from the apps/web side will re-arm the loop.
    if (!config) return;

    // Instant is webhook-driven; the alarm path is not the right
    // dispatcher. Same no-op rule as missing-config — but here we also
    // explicitly do NOT reschedule, because a non-scheduled cadence
    // shouldn't be re-armed by this DO.
    if (config.frequency === "instant") return;

    if (!VALID_SCHEDULED_FREQUENCIES.has(config.frequency as ScheduledFrequency)) {
      // Defensive: a frequency we don't know how to compute. Skip the
      // fire, don't reschedule — apps/web validates frequency before
      // calling /set-frequency, so this branch shouldn't fire from the
      // supported flow.
      return;
    }

    const space = await deps.fetchSpace(spaceId);
    if (!space) return;

    const connection = await deps.fetchActiveAirtableConnection(
      space.organizationId,
    );

    // Skip the fire when no active connection; STILL reschedule so the
    // schedule keeps firing in the background — when the user reconnects,
    // the next tick lands a successful run. Skipping the reschedule would
    // silently disable the schedule for any Space in 'pending_reauth'.
    if (connection && connection.status === "active") {
      const runId = await deps.insertScheduledRun({
        spaceId,
        connectionId: connection.id,
      });
      const result = await deps.runStart(runId);
      if (!result.ok) {
        // Rollback the orphaned queued row — mirrors the apps/web POST
        // /backup-runs failure path.
        await deps.deleteRun(runId);
      }
    }

    // Recompute + re-set alarm + write the next-scheduled-at marker.
    const nextFireMs = computeNextFire(
      config.frequency as ScheduledFrequency,
      deps.now(),
    );
    await this.state.storage.setAlarm(nextFireMs);
    await deps.updateNextScheduledAt(config.id, nextFireMs);
  }

  private async handleSetFrequency(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    if (typeof body !== "object" || body === null) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const frequency = (body as { frequency?: unknown }).frequency;
    if (
      typeof frequency !== "string" ||
      !VALID_SCHEDULED_FREQUENCIES.has(frequency as ScheduledFrequency)
    ) {
      return jsonResponse({ error: "invalid_frequency" }, 400);
    }
    const deps = this.getDeps();
    const nextFireMs = computeNextFire(
      frequency as ScheduledFrequency,
      deps.now(),
    );
    await this.state.storage.setAlarm(nextFireMs);
    return jsonResponse({ ok: true, nextFireMs }, 200);
  }

  private getDeps(): SpaceDOAlarmDeps {
    if (!this.deps) {
      this.deps = productionDeps(this.env);
    }
    return this.deps;
  }

  private spaceId(): string {
    // DOs are addressed by `idFromName(spaceId)` from the engine proxy
    // route (see /api/internal/spaces/:spaceId/set-frequency in Phase
    // B.4). `state.id.name` echoes that name back inside the DO; if
    // anyone calls `idFromString` directly with a non-named ID the name
    // will be undefined and we'll fail loudly here — that's intentional,
    // a runtime contract failure rather than a silently mis-scheduled run.
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
            frequency: backupConfigurations.frequency,
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
    insertScheduledRun: async ({ spaceId, connectionId }) => {
      const { db, sql } = createMasterDb(env);
      try {
        const [row] = await db
          .insert(backupRuns)
          .values({
            spaceId,
            connectionId,
            status: "queued",
            triggeredBy: "scheduled",
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
    updateNextScheduledAt: async (configId, nextFireMs) => {
      const { db, sql } = createMasterDb(env);
      try {
        await db
          .update(backupConfigurations)
          .set({ nextScheduledAt: new Date(nextFireMs) })
          .where(eq(backupConfigurations.id, configId));
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
  };
}

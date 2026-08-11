// @lat: [[durable-objects#Durable Objects#SpaceDO]]
// SpaceDO — per-Space scheduler + backup controller.
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
// server-instant-webhook Phase C adds a THIRD lane on the same alarm: when the
// Space's config is frequency='instant', a webhook-poll fire wakes the DO
// every webhook_poll_interval_seconds (+0–10% jitter), runs the dirty-check
// against the org-level webhook registry, and enqueues one incremental-backup
// task per dirty base. Pure decisions live in ../lib/webhooks/poll.ts.
//
// All side effects flow through SpaceDOAlarmDeps; productionDeps(env) wires the
// real DB/processRunStart, tests inject vi.fn() shapes.

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { createMasterDb } from "../db/worker";
import {
  airtableWebhookSubscriptions,
  airtableWebhooks,
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
import {
  DEFAULT_WEBHOOK_POLL_INTERVAL_SECONDS,
  IN_FLIGHT_RUN_STATUSES,
  SAFETY_SWEEP_MS,
  computeNextWebhookPollMs,
  decideWebhookPolls,
  type PollSubscription,
} from "../lib/webhooks/poll";
import {
  enqueueIncrementalBackup as enqueueIncrementalBackupTask,
} from "../lib/trigger-client";
import type { Env } from "../env";

// DO storage key for the two next-fire timestamps.
const FIRES_KEY = "schedule_fires";
// DO storage key for the webhook-poll next-fire (unix-ms), present only while
// the Space's config is frequency='instant' (server-instant-webhook Phase C).
const WEBHOOK_POLL_KEY = "webhook_poll_fire";
// DO storage key for the in-flight guard: { [baseId]: runId } of webhook runs
// this DO enqueued whose terminal state hasn't been observed yet.
const WEBHOOK_INFLIGHT_KEY = "webhook_inflight";

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
  /**
   * `backup_configurations.webhook_poll_interval_seconds` — the webhook-poll
   * cadence when dataFrequency='instant'. Optional so pre-Phase-C dep shapes
   * keep working; the DO falls back to the canonical 900s default.
   */
  webhookPollIntervalSeconds?: number | null;
}

/** Payload for the incremental-backup Trigger.dev task (workflows contract). */
export interface IncrementalBackupEnqueueInput {
  runId: string;
  spaceId: string;
  subscriptionId: string;
  baseId: string;
  connectionId: string;
  cursor: number;
  reconcile: boolean;
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
  /**
   * Record that a due scheduled fire was skipped because the Space's Airtable
   * Connection isn't active (missing / pending_reauth / invalid / refreshing).
   * The schedule still advances afterwards, so without this signal the pause is
   * invisible (next_scheduled_at keeps ticking as if healthy). The user-facing
   * "reconnect" prompt is the notifications-inbox connection-broken item; this
   * is operator/audit observability of the skipped tick.
   */
  recordSkippedFire: (input: {
    spaceId: string;
    organizationId: string;
    connectionId: string | null;
    connectionStatus: string | null;
    kinds: RunKind[];
  }) => Promise<void>;

  // --- webhook cadence polling (server-instant-webhook Phase C) ---

  /** [0, 1) — jitter source for computeNextWebhookPollMs. */
  random: () => number;
  /**
   * The Space's subscriptions joined to airtable_webhooks, filtered by the
   * dirty-check WHERE (last_ping_at > COALESCE(last_polled_at, 'epoch') OR
   * the 24h safety sweep is due). decideWebhookPolls re-applies the predicate
   * defensively.
   */
  fetchDueWebhookSubscriptions: (
    spaceId: string,
    now: Date,
  ) => Promise<PollSubscription[]>;
  /** backup_runs.status by id for the in-flight guard's tracked runs. */
  fetchRunStatuses: (runIds: string[]) => Promise<Record<string, string>>;
  /** INSERT backup_runs (status='queued', triggered_by='webhook', kind='incremental'). */
  insertWebhookRun: (input: {
    spaceId: string;
    connectionId: string;
  }) => Promise<string>;
  /** Flip the run to 'running' + persist the single-task trigger_run_ids. */
  markWebhookRunStarted: (
    runId: string,
    triggerRunId: string,
    startedAt: Date,
  ) => Promise<void>;
  enqueueIncrementalBackup: (
    payload: IncrementalBackupEnqueueInput,
  ) => Promise<{ id: string }>;
  /** Stamp the subscription's last_polled_at watermark. */
  updateSubscriptionPolledAt: (
    subscriptionId: string,
    polledAt: Date,
  ) => Promise<void>;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Min of the non-null candidates, or null when none — single-alarm dispatch. */
function minDefined(...candidates: Array<number | null>): number | null {
  const defined = candidates.filter((t): t is number => t != null);
  return defined.length > 0 ? Math.min(...defined) : null;
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

    // Arm/disarm the webhook-poll lane (server-instant-webhook Phase C). The
    // register-webhooks / unregister-webhooks engine routes call this after a
    // successful Phase E lifecycle pass; alarm() also self-arms on any tick
    // while the config says frequency='instant' (storage-drift self-heal).
    if (url.pathname === "/set-webhook-polling") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
      }
      return this.handleSetWebhookPolling(request);
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
        } else {
          // Connection missing or not active (pending_reauth / invalid /
          // refreshing): skip the fire, but record it so the paused schedule
          // isn't invisible. The schedule still advances + re-arms below, so it
          // resumes once the user reconnects; the notifications-inbox
          // connection-broken item is the user-facing reconnect prompt.
          await deps.recordSkippedFire({
            spaceId,
            organizationId: space.organizationId,
            connectionId: connection?.id ?? null,
            connectionStatus: connection?.status ?? null,
            kinds,
          });
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

    // Webhook-poll lane (server-instant-webhook Phase C): fires/arms only when
    // the config is frequency='instant'; drops its state otherwise. Runs after
    // the cron lane so a shared tick dispatches both.
    const nextWebhookPoll = await this.dispatchWebhookPoll(
      spaceId,
      config,
      now,
      deps,
    );

    const next = minDefined(nextAlarm(nextFires), nextWebhookPoll);
    if (next != null) {
      await this.state.storage.setAlarm(next);
    } else {
      await this.state.storage.deleteAlarm();
    }
    await deps.updateNextScheduled(config.id, nextFires);
  }

  /**
   * Fire the webhook-poll lane if due; return the lane's next fire (unix-ms)
   * or null when the lane is inert (config not instant). Poll-pass failures
   * are contained so the alarm always re-arms — the next interval retries.
   */
  private async dispatchWebhookPoll(
    spaceId: string,
    config: ConfigLike,
    now: Date,
    deps: SpaceDOAlarmDeps,
  ): Promise<number | null> {
    const stored =
      (await this.state.storage.get<number>(WEBHOOK_POLL_KEY)) ?? null;

    if (config.dataFrequency !== "instant") {
      // Lane disabled (config moved off instant): drop the poll state. The
      // in-flight map is kept — an unregister/re-register cycle shouldn't
      // double-enqueue a still-running incremental.
      if (stored != null) await this.state.storage.delete(WEBHOOK_POLL_KEY);
      return null;
    }

    const nowMs = now.getTime();
    if (stored != null && stored > nowMs) {
      return stored; // armed but not due this tick
    }

    // Due (stored <= now) — or instant-but-never-armed (self-heal: DO storage
    // predates Phase C or was lost): poll now, then arm the next interval.
    try {
      await this.runWebhookPollPass(spaceId, now, deps);
    } catch (err) {
      // eslint-disable-next-line no-console -- background poll observability; a silently-failing poll lane means instant backups stop while last_ping_at keeps advancing. Structured, matches the scheduler's log contract. The re-arm below is the retry.
      console.log(
        JSON.stringify({
          event: "webhook_poll_pass_failed",
          spaceId,
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    const nextPoll = computeNextWebhookPollMs(
      config.webhookPollIntervalSeconds ?? DEFAULT_WEBHOOK_POLL_INTERVAL_SECONDS,
      nowMs,
      deps.random,
    );
    await this.state.storage.put(WEBHOOK_POLL_KEY, nextPoll);
    return nextPoll;
  }

  /**
   * One webhook-poll pass: dirty-check → in-flight guard → per dirty base
   * INSERT backup_runs (triggered_by='webhook') → enqueue incremental-backup
   * → stamp last_polled_at. Skips (in-flight / paused) do NOT stamp the
   * watermark, so the next tick re-checks them.
   */
  private async runWebhookPollPass(
    spaceId: string,
    now: Date,
    deps: SpaceDOAlarmDeps,
  ): Promise<void> {
    const subscriptions = await deps.fetchDueWebhookSubscriptions(spaceId, now);

    // Reconcile the in-flight map against the run rows: keep only runs still
    // in a non-terminal state.
    const inflight =
      (await this.state.storage.get<Record<string, string>>(
        WEBHOOK_INFLIGHT_KEY,
      )) ?? {};
    const trackedRunIds = Object.values(inflight);
    const statuses =
      trackedRunIds.length > 0 ? await deps.fetchRunStatuses(trackedRunIds) : {};
    const nextInflight: Record<string, string> = {};
    for (const [baseId, runId] of Object.entries(inflight)) {
      const status = statuses[runId];
      if (status != null && IN_FLIGHT_RUN_STATUSES.has(status)) {
        nextInflight[baseId] = runId;
      }
    }

    const decisions = decideWebhookPolls({
      subscriptions,
      inFlightBaseIds: new Set(Object.keys(nextInflight)),
      now,
    });

    for (const decision of decisions) {
      if (decision.action !== "enqueue") continue;
      const sub = decision.subscription;
      const runId = await deps.insertWebhookRun({
        spaceId,
        connectionId: sub.connectionId,
      });
      let handle: { id: string };
      try {
        handle = await deps.enqueueIncrementalBackup({
          runId,
          spaceId,
          subscriptionId: sub.subscriptionId,
          baseId: sub.baseId,
          connectionId: sub.connectionId,
          cursor: sub.payloadCursor,
          reconcile: decision.reconcile,
        });
      } catch {
        // Roll back the orphaned queued row; the un-stamped watermark makes
        // the next tick retry this base.
        await deps.deleteRun(runId);
        continue;
      }
      await deps.markWebhookRunStarted(runId, handle.id, now);
      nextInflight[sub.baseId] = runId;
      await deps.updateSubscriptionPolledAt(sub.subscriptionId, now);
    }

    await this.state.storage.put(WEBHOOK_INFLIGHT_KEY, nextInflight);
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
    // A webhook-poll fire may be armed alongside the cron fires — never let a
    // schedule change push the alarm past (or clear) a pending poll.
    const storedPoll =
      (await this.state.storage.get<number>(WEBHOOK_POLL_KEY)) ?? null;
    const next = minDefined(nextAlarm(fires), storedPoll);
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

  /**
   * POST /set-webhook-polling { enabled } (server-instant-webhook Phase C).
   * enabled=true arms the jittered poll fire (interval from the Space's
   * config); enabled=false drops it. Either way the single alarm is re-armed
   * to the min of the surviving fires.
   */
  private async handleSetWebhookPolling(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).enabled !== "boolean"
    ) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const enabled = (body as { enabled: boolean }).enabled;
    const deps = this.getDeps();

    let nextPollAt: number | null = null;
    if (enabled) {
      const config = await deps.fetchConfig(this.spaceId());
      if (!config) {
        return jsonResponse({ error: "config_not_found" }, 404);
      }
      nextPollAt = computeNextWebhookPollMs(
        config.webhookPollIntervalSeconds ??
          DEFAULT_WEBHOOK_POLL_INTERVAL_SECONDS,
        deps.now().getTime(),
        deps.random,
      );
      await this.state.storage.put(WEBHOOK_POLL_KEY, nextPollAt);
    } else {
      await this.state.storage.delete(WEBHOOK_POLL_KEY);
    }

    const fires =
      (await this.state.storage.get<ScheduleFires>(FIRES_KEY)) ?? null;
    const next = minDefined(fires ? nextAlarm(fires) : null, nextPollAt);
    if (next != null) {
      await this.state.storage.setAlarm(next);
    } else {
      await this.state.storage.deleteAlarm();
    }
    return jsonResponse({ ok: true, nextPollAt }, 200);
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
    random: () => Math.random(),
    recordSkippedFire: async ({
      spaceId,
      organizationId,
      connectionId,
      connectionStatus,
      kinds,
    }) => {
      // eslint-disable-next-line no-console -- background scheduler observability; a silently-paused schedule (next_scheduled_at advancing while backups don't run) is the failure mode this surfaces. Structured, matches the cron sweep's log contract.
      console.log(
        JSON.stringify({
          event: "scheduled_fire_skipped",
          spaceId,
          organizationId,
          connectionId,
          connectionStatus,
          kinds,
        }),
      );
    },
    fetchConfig: async (spaceId) => {
      const { db, sql } = createMasterDb(env);
      try {
        const rows = await db
          .select({
            id: backupConfigurations.id,
            scope: backupConfigurations.scope,
            dataFrequency: backupConfigurations.frequency,
            schemaFrequency: backupConfigurations.schemaFrequency,
            webhookPollIntervalSeconds:
              backupConfigurations.webhookPollIntervalSeconds,
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

    // --- webhook cadence polling (server-instant-webhook Phase C) ---

    fetchDueWebhookSubscriptions: async (spaceId, now) => {
      const { db, sql: pg } = createMasterDb(env);
      try {
        // The design's dirty-check WHERE: dirty (ping since the watermark) OR
        // the 24h safety sweep. COALESCE-to-epoch makes never-polled rows
        // always due. Dates in raw fragments go over as ISO strings —
        // postgres-js serializes a bare Date via toString(), which PG rejects.
        const sweepCutoffIso = new Date(
          now.getTime() - SAFETY_SWEEP_MS,
        ).toISOString();
        return await db
          .select({
            subscriptionId: airtableWebhookSubscriptions.id,
            webhookId: airtableWebhooks.id,
            baseId: airtableWebhooks.baseId,
            connectionId: airtableWebhooks.connectionId,
            webhookStatus: airtableWebhooks.status,
            payloadCursor: airtableWebhookSubscriptions.payloadCursor,
            lastPingAt: airtableWebhooks.lastPingAt,
            lastPolledAt: airtableWebhookSubscriptions.lastPolledAt,
            lastReconciledAt: airtableWebhookSubscriptions.lastReconciledAt,
          })
          .from(airtableWebhookSubscriptions)
          .innerJoin(
            airtableWebhooks,
            eq(airtableWebhooks.id, airtableWebhookSubscriptions.webhookId),
          )
          .where(
            and(
              eq(airtableWebhookSubscriptions.spaceId, spaceId),
              or(
                sql`${airtableWebhooks.lastPingAt} > coalesce(${airtableWebhookSubscriptions.lastPolledAt}, 'epoch'::timestamptz)`,
                sql`coalesce(${airtableWebhookSubscriptions.lastPolledAt}, 'epoch'::timestamptz) < ${sweepCutoffIso}::timestamptz`,
              ),
            ),
          );
      } finally {
        await pg.end({ timeout: 5 });
      }
    },
    fetchRunStatuses: async (runIds) => {
      const { db, sql: pg } = createMasterDb(env);
      try {
        const rows = await db
          .select({ id: backupRuns.id, status: backupRuns.status })
          .from(backupRuns)
          .where(inArray(backupRuns.id, runIds));
        return Object.fromEntries(rows.map((r) => [r.id, r.status]));
      } finally {
        await pg.end({ timeout: 5 });
      }
    },
    insertWebhookRun: async ({ spaceId, connectionId }) => {
      const { db, sql: pg } = createMasterDb(env);
      try {
        const [row] = await db
          .insert(backupRuns)
          .values({
            spaceId,
            connectionId,
            status: "queued",
            triggeredBy: "webhook",
            // Webhook runs are cursor-driven payload applies, not full
            // snapshots and not schema-only captures — a third kind value.
            // The Phase D fallback route inserts kind='full' for its re-read.
            kind: "incremental",
            isTrial: false,
          })
          .returning({ id: backupRuns.id });
        if (!row) throw new Error("insert_webhook_run_returned_no_row");
        return row.id;
      } finally {
        await pg.end({ timeout: 5 });
      }
    },
    markWebhookRunStarted: async (runId, triggerRunId, startedAt) => {
      const { db, sql: pg } = createMasterDb(env);
      try {
        await db
          .update(backupRuns)
          .set({
            status: "running",
            startedAt,
            triggerRunIds: [triggerRunId],
            modifiedAt: startedAt,
          })
          .where(eq(backupRuns.id, runId));
      } finally {
        await pg.end({ timeout: 5 });
      }
    },
    enqueueIncrementalBackup: (payload) =>
      enqueueIncrementalBackupTask(env, payload),
    updateSubscriptionPolledAt: async (subscriptionId, polledAt) => {
      const { db, sql: pg } = createMasterDb(env);
      try {
        await db
          .update(airtableWebhookSubscriptions)
          .set({ lastPolledAt: polledAt, modifiedAt: polledAt })
          .where(eq(airtableWebhookSubscriptions.id, subscriptionId));
      } finally {
        await pg.end({ timeout: 5 });
      }
    },
  };
}

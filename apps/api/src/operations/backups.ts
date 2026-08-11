// Backup read endpoints — platform-free, served from the master DB (design D2/D3).
// Scope: backups:read.

import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  backupConfigurationBases,
  backupConfigurations,
  backupRetentionPolicies,
  backupRunBases,
  backupRunTables,
  backupRuns,
} from "../db/schema";
import { invalidRequest, notFound } from "../lib/errors";
import { paginate, parseCursor, parseLimit } from "../lib/pagination";
import { requireSpace } from "../lib/guards";
import { json } from "../lib/responses";
import type { Operation, OperationContext } from "../lib/registry";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function runView(r: typeof backupRuns.$inferSelect) {
  return {
    id: r.id,
    status: r.status,
    kind: r.kind,
    trigger: r.triggeredBy,
    startedAt: iso(r.startedAt),
    completedAt: iso(r.completedAt),
    counts: { records: r.recordCount, tables: r.tableCount, attachments: r.attachmentCount },
    ...(r.status === "failed" && r.errorMessage ? { errorMessage: r.errorMessage } : {}),
    createdAt: iso(r.createdAt),
  };
}

function parseInstant(raw: string | null, param: string): Date | null {
  if (raw === null) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) throw invalidRequest(`invalid_${param}`, `${param} must be an ISO-8601 timestamp.`, param);
  return new Date(t);
}

export const backupOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/runs",
    scope: "backups:read",
    summary: "List backup runs (newest first) with status/kind/date/base filters.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "backups:read");
      const limit = parseLimit(c.query.get("limit"));
      const cursor = parseCursor(c.query.get("cursor"));
      const status = c.query.get("status");
      const kind = c.query.get("kind");
      const from = parseInstant(c.query.get("from"), "from");
      const to = parseInstant(c.query.get("to"), "to");
      const baseId = c.query.get("baseId");

      const where = [eq(backupRuns.spaceId, spaceId), isNull(backupRuns.deletedAt)];
      if (status) where.push(eq(backupRuns.status, status));
      if (kind) where.push(eq(backupRuns.kind, kind));
      if (from) where.push(gte(backupRuns.startedAt, from));
      if (to) where.push(lte(backupRuns.startedAt, to));
      if (baseId) {
        // runs whose backup_run_bases include this base
        const runIds = (
          await c.db
            .selectDistinct({ runId: backupRunBases.runId })
            .from(backupRunBases)
            .where(eq(backupRunBases.atBaseId, baseId))
        ).map((r) => r.runId).filter((v): v is string => v !== null);
        if (!runIds.length) return json({ data: [], pagination: { nextCursor: null } }, c.requestId);
        where.push(inArray(backupRuns.id, runIds));
      }
      // keyset on (created_at desc, id desc) — created_at is notNull + monotonic.
      if (cursor && cursor.length === 2) {
        const [ts, id] = cursor as [string, string];
        where.push(sql`(${backupRuns.createdAt}, ${backupRuns.id}) < (${ts}, ${id})`);
      }
      const rows = await c.db
        .select()
        .from(backupRuns)
        .where(and(...where))
        .orderBy(desc(backupRuns.createdAt), desc(backupRuns.id))
        .limit(limit + 1);
      const page = paginate(rows, limit, (r) => [iso(r.createdAt)!, r.id]);
      return json({ data: page.data.map(runView), pagination: page.pagination }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/runs/{runId}",
    scope: "backups:read",
    summary: "Get a backup run with per-base and per-table breakdown.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "backups:read");
      const runId = c.params.runId!;
      const [run] = await c.db
        .select()
        .from(backupRuns)
        .where(and(eq(backupRuns.id, runId), eq(backupRuns.spaceId, spaceId), isNull(backupRuns.deletedAt)))
        .limit(1);
      if (!run) throw notFound("run_not_found", "Backup run not found.");
      const bases = await c.db.select().from(backupRunBases).where(eq(backupRunBases.runId, runId));
      const tableRows = bases.length
        ? await c.db.select().from(backupRunTables).where(inArray(backupRunTables.runBaseId, bases.map((b) => b.id)))
        : [];
      const tablesByBase = new Map<string, typeof tableRows>();
      for (const t of tableRows) {
        if (!t.runBaseId) continue;
        const arr = tablesByBase.get(t.runBaseId) ?? [];
        arr.push(t);
        tablesByBase.set(t.runBaseId, arr);
      }
      return json(
        {
          ...runView(run),
          bases: bases.map((b) => ({
            baseId: b.atBaseId,
            name: b.baseName,
            status: b.status,
            counts: { tables: b.tablesCount, records: b.recordsCount, attachments: b.attachmentsCount },
            startedAt: iso(b.startedAt),
            completedAt: iso(b.completedAt),
            ...(b.errorMessage ? { errorMessage: b.errorMessage } : {}),
            tables: (tablesByBase.get(b.id) ?? []).map((t) => ({
              tableId: t.tableId,
              name: t.tableName,
              counts: { records: t.recordCount, fields: t.fieldCount, attachments: t.attachmentCount },
            })),
          })),
        },
        c.requestId,
      );
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/configuration",
    scope: "backups:read",
    summary: "Get the Space's backup configuration.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "backups:read");
      const [cfg] = await c.db.select().from(backupConfigurations).where(eq(backupConfigurations.spaceId, spaceId)).limit(1);
      if (!cfg) throw notFound("configuration_not_found", "Backup configuration not found.");
      const bases = await c.db
        .select({ atBaseId: backupConfigurationBases.atBaseId, isIncluded: backupConfigurationBases.isIncluded, isAutoDiscovered: backupConfigurationBases.isAutoDiscovered })
        .from(backupConfigurationBases)
        .where(eq(backupConfigurationBases.backupConfigurationId, cfg.id));
      return json(
        {
          frequency: cfg.frequency,
          mode: cfg.mode,
          scope: cfg.scope,
          storageType: cfg.storageType,
          autoAddFutureBases: cfg.autoAddFutureBases,
          nextScheduledAt: iso(cfg.nextScheduledAt),
          schemaSnapshot: { frequency: cfg.schemaFrequency, nextScheduledAt: iso(cfg.schemaNextScheduledAt) },
          includedBases: bases.filter((b) => b.isIncluded).map((b) => ({ baseId: b.atBaseId, autoDiscovered: b.isAutoDiscovered })),
        },
        c.requestId,
      );
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/retention",
    scope: "backups:read",
    summary: "Get the Space's retention policy.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "backups:read");
      const [rp] = await c.db.select().from(backupRetentionPolicies).where(eq(backupRetentionPolicies.spaceId, spaceId)).limit(1);
      if (!rp) throw notFound("retention_not_found", "Retention policy not found.");
      return json(
        {
          policyTier: rp.policyTier,
          keepLastN: rp.keepLastN,
          dailyWindowDays: rp.dailyWindowDays,
          weeklyWindowDays: rp.weeklyWindowDays,
          monthlyIndefinite: rp.monthlyIndefinite,
          customRules: rp.customRules ?? null,
        },
        c.requestId,
      );
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/status",
    scope: "backups:read",
    summary: "Backup status rollup: last run, next scheduled, 30-day success rate, consecutive failures.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "backups:read");
      const recent = await c.db
        .select()
        .from(backupRuns)
        .where(and(eq(backupRuns.spaceId, spaceId), isNull(backupRuns.deletedAt)))
        .orderBy(desc(backupRuns.createdAt), desc(backupRuns.id))
        .limit(200);
      const [cfg] = await c.db
        .select({ nextScheduledAt: backupConfigurations.nextScheduledAt })
        .from(backupConfigurations)
        .where(eq(backupConfigurations.spaceId, spaceId))
        .limit(1);

      const lastRun = recent[0] ? runView(recent[0]) : null;
      // 30-day success rate over terminal runs.
      const cutoff = c.now.getTime() - 30 * 24 * 60 * 60 * 1000;
      const in30 = recent.filter((r) => r.createdAt && r.createdAt.getTime() >= cutoff);
      const terminal = in30.filter((r) => r.status === "succeeded" || r.status === "failed");
      const succeeded = terminal.filter((r) => r.status === "succeeded").length;
      const successRate30d = terminal.length ? Math.round((succeeded / terminal.length) * 100) : null;
      // consecutive failures from newest terminal run backwards.
      let consecutiveFailures = 0;
      for (const r of recent) {
        if (r.status === "succeeded") break;
        if (r.status === "failed") consecutiveFailures++;
      }
      return json(
        {
          lastRun,
          nextScheduledAt: iso(cfg?.nextScheduledAt ?? null),
          successRate30d,
          consecutiveFailures,
        },
        c.requestId,
      );
    },
  },
];

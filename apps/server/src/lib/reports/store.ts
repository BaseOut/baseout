// Master-DB store for reports — server-reports task 3.
//
// Thin, typed Drizzle wrappers over the three mirror tables plus pure input
// validation. The engine is the run/delivery writer; definitions are canonically
// written by apps/web but the engine also creates/updates them on behalf of the
// web proxy (which forwards user actions through the INTERNAL_TOKEN gate).

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import {
  reportDefinitions,
  reportRuns,
  reportDeliveries,
  spaces,
  type ReportDefinitionRow,
  type ReportRunRow,
  type ReportRecipient,
} from "../../db/schema";
import { computeNextRunAt } from "./cadence";
import type { ReportCadence, ReportDetail } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 25;

// --- pure input validation ------------------------------------------------

export interface RecipientValidation {
  ok: boolean;
  recipients?: ReportRecipient[];
  error?: string;
}

/** Validate + normalize schedule recipients server-side. Caps at 25, dedupes. */
export function validateRecipients(raw: unknown): RecipientValidation {
  if (raw == null) return { ok: true, recipients: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "recipients must be an array" };
  const seen = new Set<string>();
  const out: ReportRecipient[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: "each recipient must be an object" };
    }
    const r = item as { kind?: unknown; email?: unknown; name?: unknown };
    if (r.kind !== "member" && r.kind !== "external") {
      return { ok: false, error: "recipient.kind must be 'member' or 'external'" };
    }
    if (typeof r.email !== "string" || !EMAIL_RE.test(r.email)) {
      return { ok: false, error: `invalid recipient email: ${String(r.email)}` };
    }
    const email = r.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const recipient: ReportRecipient = { kind: r.kind, email };
    if (typeof r.name === "string" && r.name.trim()) recipient.name = r.name.trim();
    out.push(recipient);
  }
  if (out.length > MAX_RECIPIENTS) {
    return { ok: false, error: `too many recipients (max ${MAX_RECIPIENTS})` };
  }
  return { ok: true, recipients: out };
}

/** Recompute next_run_at for a clock cadence, or null for event/manual. */
export function nextRunAtFor(
  cadence: ReportCadence | null,
  scheduleDay: number | null,
  scheduleTime: string | null,
  enabled: boolean,
  from: Date,
): Date | null {
  if (!cadence || !enabled) return null;
  return computeNextRunAt({ cadence, scheduleDay, scheduleTime, from });
}

// --- definitions ----------------------------------------------------------

export interface DefinitionWithLatestRun {
  definition: ReportDefinitionRow;
  latestRun: ReportRunRow | null;
}

/** List a Space's definitions, each with its most recent run (by window_end). */
export async function listDefinitions(
  db: AppDb,
  spaceId: string,
): Promise<DefinitionWithLatestRun[]> {
  const defs = await db
    .select()
    .from(reportDefinitions)
    .where(eq(reportDefinitions.spaceId, spaceId))
    .orderBy(desc(reportDefinitions.isDefault), reportDefinitions.name);
  if (defs.length === 0) return [];

  const runs = await db
    .select()
    .from(reportRuns)
    .where(
      inArray(
        reportRuns.reportDefinitionId,
        defs.map((d) => d.id),
      ),
    )
    .orderBy(desc(reportRuns.windowEnd));

  const latestByDef = new Map<string, ReportRunRow>();
  for (const run of runs) {
    if (!latestByDef.has(run.reportDefinitionId)) {
      latestByDef.set(run.reportDefinitionId, run);
    }
  }
  return defs.map((definition) => ({
    definition,
    latestRun: latestByDef.get(definition.id) ?? null,
  }));
}

export async function getDefinition(
  db: AppDb,
  spaceId: string,
  defId: string,
): Promise<ReportDefinitionRow | null> {
  const [row] = await db
    .select()
    .from(reportDefinitions)
    .where(and(eq(reportDefinitions.id, defId), eq(reportDefinitions.spaceId, spaceId)))
    .limit(1);
  return row ?? null;
}

export interface CreateDefinitionInput {
  spaceId: string;
  name: string;
  sections: string[];
  baseScope: string[] | null;
  windowKind: string;
  windowDays: number | null;
  scheduleCadence: ReportCadence | null;
  scheduleDay: number | null;
  scheduleTime: string | null;
  scheduleFormats: string[];
  scheduleRecipients: ReportRecipient[];
  scheduleSuppressEmpty: boolean;
  scheduleEnabled: boolean;
  createdBy: string | null;
  now: Date;
}

export async function createDefinition(
  db: AppDb,
  input: CreateDefinitionInput,
): Promise<ReportDefinitionRow> {
  const nextRunAt = nextRunAtFor(
    input.scheduleCadence,
    input.scheduleDay,
    input.scheduleTime,
    input.scheduleEnabled,
    input.now,
  );
  const [row] = await db
    .insert(reportDefinitions)
    .values({
      spaceId: input.spaceId,
      name: input.name,
      sections: input.sections,
      baseScope: input.baseScope,
      windowKind: input.windowKind,
      windowDays: input.windowDays,
      isDefault: false, // user-created definitions are never the default
      scheduleCadence: input.scheduleCadence,
      scheduleDay: input.scheduleDay,
      scheduleTime: input.scheduleTime,
      scheduleFormats: input.scheduleFormats,
      scheduleRecipients: input.scheduleRecipients,
      scheduleSuppressEmpty: input.scheduleSuppressEmpty,
      scheduleEnabled: input.scheduleEnabled,
      nextRunAt,
      createdBy: input.createdBy,
    })
    .returning();
  if (!row) throw new Error("report_definition insert returned no row");
  return row;
}

export type UpdateDefinitionPatch = Partial<
  Omit<CreateDefinitionInput, "spaceId" | "createdBy" | "now">
>;

export async function updateDefinition(
  db: AppDb,
  spaceId: string,
  defId: string,
  patch: UpdateDefinitionPatch,
  now: Date,
): Promise<ReportDefinitionRow | null> {
  const existing = await getDefinition(db, spaceId, defId);
  if (!existing) return null;

  const cadence = (patch.scheduleCadence ?? existing.scheduleCadence) as ReportCadence | null;
  const day = patch.scheduleDay ?? existing.scheduleDay;
  const time = patch.scheduleTime ?? existing.scheduleTime;
  const enabled = patch.scheduleEnabled ?? existing.scheduleEnabled;
  const nextRunAt = nextRunAtFor(cadence, day, time, enabled, now);

  const [row] = await db
    .update(reportDefinitions)
    .set({
      ...patch,
      nextRunAt,
      modifiedAt: now,
    })
    .where(and(eq(reportDefinitions.id, defId), eq(reportDefinitions.spaceId, spaceId)))
    .returning();
  return row ?? null;
}

export type DeleteDefinitionResult = "deleted" | "not_found" | "is_default";

export async function deleteDefinition(
  db: AppDb,
  spaceId: string,
  defId: string,
): Promise<DeleteDefinitionResult> {
  const existing = await getDefinition(db, spaceId, defId);
  if (!existing) return "not_found";
  if (existing.isDefault) return "is_default"; // the default report is protected
  await db
    .delete(reportDefinitions)
    .where(and(eq(reportDefinitions.id, defId), eq(reportDefinitions.spaceId, spaceId)));
  return "deleted";
}

export async function countDefinitions(db: AppDb, spaceId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reportDefinitions)
    .where(eq(reportDefinitions.spaceId, spaceId));
  return row?.n ?? 0;
}

/**
 * Count user-created (non-default) report definitions across an Org's Spaces —
 * the denominator for the org-scoped `active_reports` creation cap. Auto-created
 * default reports don't count against the quota.
 */
export async function countActiveReportsForOrg(db: AppDb, orgId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reportDefinitions)
    .innerJoin(spaces, eq(reportDefinitions.spaceId, spaces.id))
    .where(and(eq(spaces.organizationId, orgId), eq(reportDefinitions.isDefault, false)));
  return row?.n ?? 0;
}

/** Enabled definitions in a Space with a given event cadence (after-backup hook). */
export async function listEnabledDefinitionsByCadence(
  db: AppDb,
  spaceId: string,
  cadence: string,
): Promise<ReportDefinitionRow[]> {
  return await db
    .select()
    .from(reportDefinitions)
    .where(
      and(
        eq(reportDefinitions.spaceId, spaceId),
        eq(reportDefinitions.scheduleCadence, cadence),
        eq(reportDefinitions.scheduleEnabled, true),
      ),
    );
}

/** Enabled weekly/monthly definitions due at `now` (cron sweep). */
export async function listDueClockDefinitions(
  db: AppDb,
  now: Date,
): Promise<ReportDefinitionRow[]> {
  return await db
    .select()
    .from(reportDefinitions)
    .where(
      and(
        eq(reportDefinitions.scheduleEnabled, true),
        inArray(reportDefinitions.scheduleCadence, ["weekly", "monthly"]),
        sql`${reportDefinitions.nextRunAt} IS NOT NULL AND ${reportDefinitions.nextRunAt} <= ${now}`,
      ),
    );
}

/** Advance a definition's next_run_at after a scheduled fire. */
export async function setNextRunAt(
  db: AppDb,
  defId: string,
  nextRunAt: Date | null,
): Promise<void> {
  await db
    .update(reportDefinitions)
    .set({ nextRunAt })
    .where(eq(reportDefinitions.id, defId));
}

// --- runs -----------------------------------------------------------------

/** Postgres unique_violation SQLSTATE — the one-running guard trips this. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

export interface InsertRunningRunInput {
  spaceId: string;
  reportDefinitionId: string;
  windowStart: Date;
  windowEnd: Date;
  adHoc: boolean;
  triggerKind: "scheduled" | "manual";
  triggerBy: string | null;
}

/**
 * Insert a `running` run. The partial-unique index (one running per definition)
 * rejects a concurrent generation — surfaced as { ok:false }, never an error.
 */
export async function insertRunningRun(
  db: AppDb,
  input: InsertRunningRunInput,
): Promise<{ ok: boolean; runId?: string }> {
  try {
    const [row] = await db
      .insert(reportRuns)
      .values({
        spaceId: input.spaceId,
        reportDefinitionId: input.reportDefinitionId,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        adHoc: input.adHoc,
        triggerKind: input.triggerKind,
        triggerBy: input.triggerBy,
        generationState: "running",
      })
      .returning({ id: reportRuns.id });
    if (!row) return { ok: false };
    return { ok: true, runId: row.id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false };
    throw err;
  }
}

/** A definition's run history, newest-first. */
export async function listRunsForDefinition(
  db: AppDb,
  spaceId: string,
  defId: string,
): Promise<ReportRunRow[]> {
  return await db
    .select()
    .from(reportRuns)
    .where(and(eq(reportRuns.spaceId, spaceId), eq(reportRuns.reportDefinitionId, defId)))
    .orderBy(desc(reportRuns.windowEnd));
}

export async function getRun(
  db: AppDb,
  spaceId: string,
  runId: string,
): Promise<ReportRunRow | null> {
  const [row] = await db
    .select()
    .from(reportRuns)
    .where(and(eq(reportRuns.id, runId), eq(reportRuns.spaceId, spaceId)))
    .limit(1);
  return row ?? null;
}

/** Look up a run by id alone (workflow callback has no spaceId). */
export async function getRunById(db: AppDb, runId: string): Promise<ReportRunRow | null> {
  const [row] = await db.select().from(reportRuns).where(eq(reportRuns.id, runId)).limit(1);
  return row ?? null;
}

/** After assembly: record the document location + headline counts + verdict. */
export async function recordDocument(
  db: AppDb,
  runId: string,
  documentLocation: string,
  doc: ReportDetail,
): Promise<void> {
  await db
    .update(reportRuns)
    .set({
      documentLocation,
      backupsOk: doc.backupsOk,
      backupsFailed: doc.backupsFailed,
      status: doc.status,
    })
    .where(eq(reportRuns.id, runId));
}

export async function markRunFailed(db: AppDb, runId: string, error: string): Promise<void> {
  await db
    .update(reportRuns)
    .set({ generationState: "failed", status: "failed", error })
    .where(eq(reportRuns.id, runId));
}

/** Render callback: record artifact locations + flip to generated. */
export async function recordRendered(
  db: AppDb,
  runId: string,
  input: { pdfLocation?: string | null; htmlLocation?: string | null; now: Date },
): Promise<void> {
  await db
    .update(reportRuns)
    .set({
      artifactPdfLocation: input.pdfLocation ?? null,
      artifactHtmlLocation: input.htmlLocation ?? null,
      generationState: "generated",
      generatedAt: input.now,
    })
    .where(eq(reportRuns.id, runId));
}

// --- deliveries -----------------------------------------------------------

export interface InsertedDelivery {
  id: string;
  recipientEmail: string;
  format: string;
}

export async function insertDeliveries(
  db: AppDb,
  runId: string,
  rows: {
    recipientEmail: string;
    recipientKind: "member" | "external";
    format: "pdf" | "html";
  }[],
): Promise<InsertedDelivery[]> {
  if (rows.length === 0) return [];
  return await db
    .insert(reportDeliveries)
    .values(rows.map((r) => ({ ...r, reportRunId: runId, status: "pending" })))
    .returning({
      id: reportDeliveries.id,
      recipientEmail: reportDeliveries.recipientEmail,
      format: reportDeliveries.format,
    });
}

export async function markDelivery(
  db: AppDb,
  deliveryId: string,
  status: "sent" | "failed",
  input: { error?: string | null; now: Date },
): Promise<void> {
  await db
    .update(reportDeliveries)
    .set({
      status,
      error: input.error ?? null,
      sentAt: status === "sent" ? input.now : null,
    })
    .where(eq(reportDeliveries.id, deliveryId));
}

/** Failed deliveries for a run — the re-send set. */
export async function listFailedDeliveries(db: AppDb, runId: string) {
  return await db
    .select()
    .from(reportDeliveries)
    .where(and(eq(reportDeliveries.reportRunId, runId), eq(reportDeliveries.status, "failed")));
}

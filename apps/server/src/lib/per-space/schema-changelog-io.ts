// Per-Space schema changelog I/O (server-schema-changelog).
//
// Runs inside `withSpaceSchema(...)`. Assembles a base's changelog at read time
// from data already persisted: MODIFICATIONS from bo_at_schema_updates (joined to
// their run for a date) + REMOVALS from the entity lifecycle columns
// (status='removed' + first_unseen_run). No new capture, no Trigger.dev task.
// The pure merge/sort/limit lives in schema-changelog.ts (unit-tested); this file
// only fetches rows. Mirrors relationships-io.ts.

import { and, eq, isNotNull } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import {
  assembleChangelog,
  type ChangelogModificationRow,
  type ChangelogRemovalRow,
  type ChangelogEntityType,
  type SchemaChangelog,
} from "./schema-changelog";

function iso(completed: Date | null, started: Date | null): string | null {
  const d = completed ?? started;
  return d ? d.toISOString() : null;
}

/**
 * Read a base's schema changelog: schema-update modifications (with run dates) +
 * lifecycle removals of tables / fields / views. Sorted newest-first, limited.
 */
export async function readSchemaChangelog(
  tx: SpaceTx,
  baseId: string,
  opts?: { limit?: number },
): Promise<SchemaChangelog> {
  const updateRows = await tx
    .select({
      id: spacePg.schemaUpdates.id,
      runId: spacePg.schemaUpdates.runId,
      entityType: spacePg.schemaUpdates.entityType,
      entityId: spacePg.schemaUpdates.entityId,
      baseId: spacePg.schemaUpdates.baseId,
      tableId: spacePg.schemaUpdates.tableId,
      changeType: spacePg.schemaUpdates.changeType,
      changeTypeName: spacePg.schemaUpdates.changeTypeName,
      beforeValue: spacePg.schemaUpdates.beforeValue,
      afterValue: spacePg.schemaUpdates.afterValue,
      breaksData: spacePg.schemaUpdates.breaksData,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.schemaUpdates)
    .leftJoin(spacePg.baseRuns, eq(spacePg.schemaUpdates.runId, spacePg.baseRuns.id))
    .where(eq(spacePg.schemaUpdates.baseId, baseId));

  const modifications: ChangelogModificationRow[] = updateRows.map((r) => ({
    id: r.id,
    runId: r.runId,
    entityType: r.entityType as ChangelogEntityType,
    entityId: r.entityId,
    baseId: r.baseId,
    tableId: r.tableId,
    changeType: r.changeType,
    changeTypeName: r.changeTypeName,
    beforeValue: r.beforeValue,
    afterValue: r.afterValue,
    breaksData: r.breaksData,
    at: iso(r.completedAt, r.startedAt),
  }));

  // Removals: one query per entity table, LEFT JOIN to the run that first
  // didn't see it for a date. Bases are omitted — a base-level removal isn't a
  // per-base changelog event.
  const removals: ChangelogRemovalRow[] = [];

  const tableRemovals = await tx
    .select({
      runId: spacePg.tables.firstUnseenRun,
      entityId: spacePg.tables.tableId,
      name: spacePg.tables.name,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.tables)
    .leftJoin(spacePg.baseRuns, eq(spacePg.tables.firstUnseenRun, spacePg.baseRuns.id))
    .where(
      and(
        eq(spacePg.tables.baseId, baseId),
        eq(spacePg.tables.status, "removed"),
        isNotNull(spacePg.tables.firstUnseenRun),
      ),
    );
  for (const r of tableRemovals) {
    removals.push({
      runId: r.runId,
      entityType: "table",
      entityId: r.entityId,
      baseId,
      tableId: r.entityId,
      name: r.name,
      at: iso(r.completedAt, r.startedAt),
    });
  }

  const fieldRemovals = await tx
    .select({
      runId: spacePg.fields.firstUnseenRun,
      entityId: spacePg.fields.fieldId,
      tableId: spacePg.fields.tableId,
      name: spacePg.fields.name,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.fields)
    .leftJoin(spacePg.baseRuns, eq(spacePg.fields.firstUnseenRun, spacePg.baseRuns.id))
    .where(
      and(
        eq(spacePg.fields.baseId, baseId),
        eq(spacePg.fields.status, "removed"),
        isNotNull(spacePg.fields.firstUnseenRun),
      ),
    );
  for (const r of fieldRemovals) {
    removals.push({
      runId: r.runId,
      entityType: "field",
      entityId: r.entityId,
      baseId,
      tableId: r.tableId,
      name: r.name,
      at: iso(r.completedAt, r.startedAt),
    });
  }

  const viewRemovals = await tx
    .select({
      runId: spacePg.views.firstUnseenRun,
      entityId: spacePg.views.viewId,
      tableId: spacePg.views.tableId,
      name: spacePg.views.name,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.views)
    .leftJoin(spacePg.baseRuns, eq(spacePg.views.firstUnseenRun, spacePg.baseRuns.id))
    .where(
      and(
        eq(spacePg.views.baseId, baseId),
        eq(spacePg.views.status, "removed"),
        isNotNull(spacePg.views.firstUnseenRun),
      ),
    );
  for (const r of viewRemovals) {
    removals.push({
      runId: r.runId,
      entityType: "view",
      entityId: r.entityId,
      baseId,
      tableId: r.tableId,
      name: r.name,
      at: iso(r.completedAt, r.startedAt),
    });
  }

  // Interface apps/pages/forms removals — RUN-based lifecycle since
  // server-interfaces-normalize (firstUnseenRun → that base run's completed_at,
  // like the schema-table removals above). The old single bo_at_interfaces was
  // split into three entity tables; each surfaces its own entity_type.
  const interfaceAppRemovals = await tx
    .select({
      runId: spacePg.interfaces.firstUnseenRun,
      entityId: spacePg.interfaces.airtableEntityId,
      name: spacePg.interfaces.name,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.interfaces)
    .leftJoin(spacePg.baseRuns, eq(spacePg.interfaces.firstUnseenRun, spacePg.baseRuns.id))
    .where(
      and(
        eq(spacePg.interfaces.baseId, baseId),
        eq(spacePg.interfaces.status, "removed"),
        isNotNull(spacePg.interfaces.firstUnseenRun),
      ),
    );
  for (const r of interfaceAppRemovals) {
    removals.push({
      runId: r.runId,
      entityType: "interface",
      entityId: r.entityId ?? "",
      baseId,
      tableId: null,
      name: r.name ?? "",
      at: iso(r.completedAt, r.startedAt),
    });
  }

  const pageRemovals = await tx
    .select({
      runId: spacePg.pages.firstUnseenRun,
      entityId: spacePg.pages.airtableEntityId,
      name: spacePg.pages.name,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.pages)
    .leftJoin(spacePg.baseRuns, eq(spacePg.pages.firstUnseenRun, spacePg.baseRuns.id))
    .where(
      and(
        eq(spacePg.pages.baseId, baseId),
        eq(spacePg.pages.status, "removed"),
        isNotNull(spacePg.pages.firstUnseenRun),
      ),
    );
  for (const r of pageRemovals) {
    removals.push({
      runId: r.runId,
      entityType: "page",
      entityId: r.entityId ?? "",
      baseId,
      tableId: null,
      name: r.name ?? "",
      at: iso(r.completedAt, r.startedAt),
    });
  }

  const formRemovals = await tx
    .select({
      runId: spacePg.forms.firstUnseenRun,
      entityId: spacePg.forms.airtableEntityId,
      name: spacePg.forms.name,
      startedAt: spacePg.baseRuns.startedAt,
      completedAt: spacePg.baseRuns.completedAt,
    })
    .from(spacePg.forms)
    .leftJoin(spacePg.baseRuns, eq(spacePg.forms.firstUnseenRun, spacePg.baseRuns.id))
    .where(
      and(
        eq(spacePg.forms.baseId, baseId),
        eq(spacePg.forms.status, "removed"),
        isNotNull(spacePg.forms.firstUnseenRun),
      ),
    );
  for (const r of formRemovals) {
    removals.push({
      runId: r.runId,
      entityType: "form",
      entityId: r.entityId ?? "",
      baseId,
      tableId: null,
      name: r.name ?? "",
      at: iso(r.completedAt, r.startedAt),
    });
  }

  const automationRemovals = await tx
    .select({
      entityId: spacePg.automations.airtableEntityId,
      name: spacePg.automations.name,
      lastSeenAt: spacePg.automations.lastSeenAt,
    })
    .from(spacePg.automations)
    .where(
      and(
        eq(spacePg.automations.baseId, baseId),
        eq(spacePg.automations.status, "removed"),
        isNotNull(spacePg.automations.lastSeenAt),
      ),
    );
  for (const r of automationRemovals) {
    removals.push({
      runId: null,
      entityType: "automation",
      entityId: r.entityId ?? "",
      baseId,
      tableId: null,
      name: r.name ?? "",
      at: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
    });
  }

  return assembleChangelog(modifications, removals, { limit: opts?.limit ?? 200 });
}

// Per-Space Automations & Interfaces manual CRUD I/O
// (server-automations-interfaces-manual-crud).
//
// Runs inside `withSpaceSchema(...)`. One module, `kind: 'automation'|'interface'`
// parameter. Automations live in bo_at_automations (submission timestamps).
// Interfaces are normalized (server-interfaces-normalize): apps in
// bo_at_interfaces, pages in bo_at_pages with interface_id as parent. The API
// still presents a unified `type: 'interface'|'page'` + `parentId` shape for
// the Schema tabs. Tags live in bo_at_entity_tags; update replaces only
// source='manual' rows (seeded auto tags are preserved).

import { and, eq, inArray, ne } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import { entityKey, flagRemovedTags } from "./documents-logic";

export type EntityKind = "automation" | "interface";
export type InterfaceType = "interface" | "page";
export type TagTargetType = "table" | "field";
export type TagSource = "auto" | "manual";

export interface EntityTagInput {
  targetType: TagTargetType;
  targetId: string;
  source?: TagSource;
}

export interface EntityTagView {
  id: string;
  targetType: TagTargetType;
  targetId: string;
  source: TagSource;
  targetRemoved: boolean;
}

export interface AutomationView {
  id: string;
  baseId: string;
  airtableEntityId: string | null;
  name: string | null;
  type: string | null;
  definition: unknown;
  status: string;
  submittedVia: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  tags: EntityTagView[];
}

export interface InterfaceView {
  id: string;
  baseId: string;
  airtableEntityId: string | null;
  name: string | null;
  type: InterfaceType;
  definition: unknown;
  status: string;
  submittedVia: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  parentId: string | null;
  tags: EntityTagView[];
}

export type CreateAutomationInput = {
  baseId: string;
  airtableEntityId?: string | null;
  name?: string | null;
  type?: string | null;
  definition?: unknown;
  tags?: EntityTagInput[];
};

export type CreateInterfaceInput = {
  baseId: string;
  airtableEntityId?: string | null;
  name?: string | null;
  type: InterfaceType;
  parentId?: string | null;
  definition?: unknown;
  tags?: EntityTagInput[];
};

export type UpdateAutomationInput = {
  id: string;
  name?: string | null;
  type?: string | null;
  definition?: unknown;
  /** When present, full-replaces source='manual' tags only. */
  tags?: EntityTagInput[];
};

export type UpdateInterfaceInput = {
  id: string;
  name?: string | null;
  type?: InterfaceType;
  parentId?: string | null;
  definition?: unknown;
  tags?: EntityTagInput[];
};

export type IoError =
  | { ok: false; code: "duplicate_entity" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "invalid_parent" }
  | { ok: false; code: "invalid_request"; message?: string };

export type CreateResult<T> = { ok: true; entity: T } | IoError;
export type UpdateResult<T> = { ok: true; entity: T } | IoError;
export type RemoveResult = { ok: true } | IoError;

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return (
    e?.code === "23505" ||
    e?.cause?.code === "23505" ||
    (typeof e?.message === "string" && e.message.includes("duplicate key"))
  );
}

async function loadActiveTableFieldKeys(tx: SpaceTx): Promise<Set<string>> {
  const [tables, fields] = await Promise.all([
    tx.select({ id: spacePg.tables.tableId, status: spacePg.tables.status }).from(spacePg.tables),
    tx.select({ id: spacePg.fields.fieldId, status: spacePg.fields.status }).from(spacePg.fields),
  ]);
  const keys = new Set<string>();
  for (const t of tables) if (t.status !== "removed") keys.add(entityKey("table", t.id));
  for (const f of fields) if (f.status !== "removed") keys.add(entityKey("field", f.id));
  return keys;
}

async function readTagsFor(
  tx: SpaceTx,
  entityKind: EntityKind,
  entityIds: string[],
  activeKeys: Set<string>,
): Promise<Map<string, EntityTagView[]>> {
  const out = new Map<string, EntityTagView[]>();
  if (entityIds.length === 0) return out;
  const rows = await tx
    .select({
      id: spacePg.entityTags.id,
      entityId: spacePg.entityTags.entityId,
      targetType: spacePg.entityTags.targetType,
      targetId: spacePg.entityTags.targetId,
      source: spacePg.entityTags.source,
    })
    .from(spacePg.entityTags)
    .where(
      and(
        eq(spacePg.entityTags.entityKind, entityKind),
        inArray(spacePg.entityTags.entityId, entityIds),
      ),
    );
  const flagged = flagRemovedTags(rows, activeKeys);
  for (const t of flagged) {
    const view: EntityTagView = {
      id: t.id,
      targetType: t.targetType as TagTargetType,
      targetId: t.targetId,
      source: (t.source as TagSource) ?? "manual",
      targetRemoved: t.entityRemoved,
    };
    const list = out.get(t.entityId) ?? [];
    list.push(view);
    out.set(t.entityId, list);
  }
  return out;
}

async function insertManualTags(
  tx: SpaceTx,
  entityKind: EntityKind,
  entityId: string,
  tags: EntityTagInput[] | undefined,
): Promise<void> {
  if (!tags?.length) return;
  const now = new Date();
  await tx.insert(spacePg.entityTags).values(
    tags.map((t) => ({
      entityKind,
      entityId,
      targetType: t.targetType,
      targetId: t.targetId,
      source: t.source === "auto" ? "auto" : "manual",
      addedAt: now,
    })),
  );
}

/** Replace only source='manual' tags; leave auto rows untouched. */
async function replaceManualTags(
  tx: SpaceTx,
  entityKind: EntityKind,
  entityId: string,
  tags: EntityTagInput[],
): Promise<void> {
  await tx
    .delete(spacePg.entityTags)
    .where(
      and(
        eq(spacePg.entityTags.entityKind, entityKind),
        eq(spacePg.entityTags.entityId, entityId),
        eq(spacePg.entityTags.source, "manual"),
      ),
    );
  const now = new Date();
  const manual = tags.filter((t) => t.source !== "auto");
  if (manual.length === 0) return;
  await tx.insert(spacePg.entityTags).values(
    manual.map((t) => ({
      entityKind,
      entityId,
      targetType: t.targetType,
      targetId: t.targetId,
      source: "manual" as const,
      addedAt: now,
    })),
  );
}

export async function listAutomations(
  tx: SpaceTx,
  opts?: { baseId?: string; includeRemoved?: boolean },
): Promise<AutomationView[]> {
  const conditions = [];
  if (opts?.baseId) conditions.push(eq(spacePg.automations.baseId, opts.baseId));
  if (!opts?.includeRemoved) conditions.push(ne(spacePg.automations.status, "removed"));

  const rows = await tx
    .select()
    .from(spacePg.automations)
    .where(conditions.length ? and(...conditions) : undefined);

  const activeKeys = await loadActiveTableFieldKeys(tx);
  const tagsBy = await readTagsFor(
    tx,
    "automation",
    rows.map((r) => r.id),
    activeKeys,
  );

  return rows.map((r) => ({
    id: r.id,
    baseId: r.baseId,
    airtableEntityId: r.airtableEntityId,
    name: r.name,
    type: r.type,
    definition: r.definition ?? null,
    status: r.status,
    submittedVia: r.submittedVia,
    firstSeenAt: iso(r.firstSeenAt),
    lastSeenAt: iso(r.lastSeenAt),
    tags: tagsBy.get(r.id) ?? [],
  }));
}

export async function listInterfaces(
  tx: SpaceTx,
  opts?: { baseId?: string; includeRemoved?: boolean },
): Promise<InterfaceView[]> {
  const appConds = [];
  const pageConds = [];
  if (opts?.baseId) {
    appConds.push(eq(spacePg.interfaces.baseId, opts.baseId));
    pageConds.push(eq(spacePg.pages.baseId, opts.baseId));
  }
  if (!opts?.includeRemoved) {
    appConds.push(ne(spacePg.interfaces.status, "removed"));
    pageConds.push(ne(spacePg.pages.status, "removed"));
  }

  const [apps, pages] = await Promise.all([
    tx
      .select()
      .from(spacePg.interfaces)
      .where(appConds.length ? and(...appConds) : undefined),
    tx
      .select()
      .from(spacePg.pages)
      .where(pageConds.length ? and(...pageConds) : undefined),
  ]);

  const ids = [...apps.map((a) => a.id), ...pages.map((p) => p.id)];
  const activeKeys = await loadActiveTableFieldKeys(tx);
  const tagsBy = await readTagsFor(tx, "interface", ids, activeKeys);

  const views: InterfaceView[] = [
    ...apps.map((r) => ({
      id: r.id,
      baseId: r.baseId,
      airtableEntityId: r.airtableEntityId,
      name: r.name,
      type: "interface" as const,
      definition: r.definition ?? null,
      status: r.status,
      submittedVia: r.submittedVia,
      firstSeenAt: null,
      lastSeenAt: null,
      parentId: null,
      tags: tagsBy.get(r.id) ?? [],
    })),
    ...pages.map((r) => ({
      id: r.id,
      baseId: r.baseId,
      airtableEntityId: r.airtableEntityId,
      name: r.name,
      type: "page" as const,
      definition: r.definition ?? null,
      status: r.status,
      submittedVia: r.submittedVia,
      firstSeenAt: null,
      lastSeenAt: null,
      parentId: r.interfaceId,
      tags: tagsBy.get(r.id) ?? [],
    })),
  ];
  return views;
}

export async function createAutomation(
  tx: SpaceTx,
  input: CreateAutomationInput,
): Promise<CreateResult<AutomationView>> {
  if (!input.baseId) return { ok: false, code: "invalid_request", message: "baseId required" };
  const now = new Date();
  try {
    const [row] = await tx
      .insert(spacePg.automations)
      .values({
        baseId: input.baseId,
        airtableEntityId: input.airtableEntityId ?? null,
        name: input.name ?? null,
        type: input.type ?? null,
        definition: input.definition ?? null,
        status: "active",
        submittedVia: "manual_form",
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning();
    if (!row) return { ok: false, code: "invalid_request" };
    await insertManualTags(tx, "automation", row.id, input.tags);
    const entity = (await listAutomations(tx, { includeRemoved: true })).find((a) => a.id === row.id)!;
    return { ok: true, entity };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, code: "duplicate_entity" };
    throw err;
  }
}

async function validatePageParent(
  tx: SpaceTx,
  baseId: string,
  parentId: string | null | undefined,
): Promise<IoError | null> {
  if (!parentId) return { ok: false, code: "invalid_parent" };
  const [parent] = await tx
    .select({
      id: spacePg.interfaces.id,
      baseId: spacePg.interfaces.baseId,
      airtableEntityId: spacePg.interfaces.airtableEntityId,
      status: spacePg.interfaces.status,
    })
    .from(spacePg.interfaces)
    .where(
      and(
        eq(spacePg.interfaces.baseId, baseId),
        eq(spacePg.interfaces.airtableEntityId, parentId),
        ne(spacePg.interfaces.status, "removed"),
      ),
    )
    .limit(1);
  if (!parent) return { ok: false, code: "invalid_parent" };
  return null;
}

export async function createInterface(
  tx: SpaceTx,
  input: CreateInterfaceInput,
): Promise<CreateResult<InterfaceView>> {
  if (!input.baseId) return { ok: false, code: "invalid_request", message: "baseId required" };
  if (input.type !== "interface" && input.type !== "page") {
    return { ok: false, code: "invalid_request", message: "type must be interface|page" };
  }

  if (input.type === "page") {
    const parentErr = await validatePageParent(tx, input.baseId, input.parentId);
    if (parentErr) return parentErr;
  }

  try {
    if (input.type === "interface") {
      const [row] = await tx
        .insert(spacePg.interfaces)
        .values({
          baseId: input.baseId,
          airtableEntityId: input.airtableEntityId ?? null,
          name: input.name ?? null,
          definition: input.definition ?? null,
          status: "active",
          submittedVia: "manual_form",
        })
        .returning();
      if (!row) return { ok: false, code: "invalid_request" };
      await insertManualTags(tx, "interface", row.id, input.tags);
      const entity = (await listInterfaces(tx, { includeRemoved: true })).find((i) => i.id === row.id)!;
      return { ok: true, entity };
    }

    const [row] = await tx
      .insert(spacePg.pages)
      .values({
        baseId: input.baseId,
        airtableEntityId: input.airtableEntityId ?? null,
        interfaceId: input.parentId ?? null,
        name: input.name ?? null,
        definition: input.definition ?? null,
        status: "active",
        submittedVia: "manual_form",
      })
      .returning();
    if (!row) return { ok: false, code: "invalid_request" };
    await insertManualTags(tx, "interface", row.id, input.tags);
    const entity = (await listInterfaces(tx, { includeRemoved: true })).find((i) => i.id === row.id)!;
    return { ok: true, entity };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, code: "duplicate_entity" };
    throw err;
  }
}

export async function updateAutomation(
  tx: SpaceTx,
  input: UpdateAutomationInput,
): Promise<UpdateResult<AutomationView>> {
  const [existing] = await tx
    .select({ id: spacePg.automations.id })
    .from(spacePg.automations)
    .where(eq(spacePg.automations.id, input.id))
    .limit(1);
  if (!existing) return { ok: false, code: "not_found" };

  const patch: Partial<typeof spacePg.automations.$inferInsert> = {
    lastSeenAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.definition !== undefined) patch.definition = input.definition;

  await tx.update(spacePg.automations).set(patch).where(eq(spacePg.automations.id, input.id));
  if (input.tags) await replaceManualTags(tx, "automation", input.id, input.tags);

  const entity = (await listAutomations(tx, { includeRemoved: true })).find((a) => a.id === input.id)!;
  return { ok: true, entity };
}

export async function updateInterface(
  tx: SpaceTx,
  input: UpdateInterfaceInput,
): Promise<UpdateResult<InterfaceView>> {
  const [app] = await tx
    .select({ id: spacePg.interfaces.id, baseId: spacePg.interfaces.baseId })
    .from(spacePg.interfaces)
    .where(eq(spacePg.interfaces.id, input.id))
    .limit(1);
  const [page] = app
    ? [null]
    : await tx
        .select({
          id: spacePg.pages.id,
          baseId: spacePg.pages.baseId,
        })
        .from(spacePg.pages)
        .where(eq(spacePg.pages.id, input.id))
        .limit(1);

  if (!app && !page) return { ok: false, code: "not_found" };

  if (app) {
    const patch: Partial<typeof spacePg.interfaces.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.definition !== undefined) patch.definition = input.definition;
    if (Object.keys(patch).length) {
      await tx.update(spacePg.interfaces).set(patch).where(eq(spacePg.interfaces.id, input.id));
    }
  } else if (page) {
    if (input.parentId !== undefined) {
      const parentErr = await validatePageParent(tx, page.baseId, input.parentId);
      if (parentErr) return parentErr;
    }
    const patch: Partial<typeof spacePg.pages.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.definition !== undefined) patch.definition = input.definition;
    if (input.parentId !== undefined) patch.interfaceId = input.parentId;
    if (Object.keys(patch).length) {
      await tx.update(spacePg.pages).set(patch).where(eq(spacePg.pages.id, input.id));
    }
  }

  if (input.tags) await replaceManualTags(tx, "interface", input.id, input.tags);
  const entity = (await listInterfaces(tx, { includeRemoved: true })).find((i) => i.id === input.id)!;
  return { ok: true, entity };
}

export async function removeAutomation(tx: SpaceTx, id: string): Promise<RemoveResult> {
  const now = new Date();
  const updated = await tx
    .update(spacePg.automations)
    .set({ status: "removed", lastSeenAt: now })
    .where(eq(spacePg.automations.id, id))
    .returning({ id: spacePg.automations.id });
  if (updated.length === 0) return { ok: false, code: "not_found" };
  return { ok: true };
}

export async function removeInterface(tx: SpaceTx, id: string): Promise<RemoveResult> {
  const app = await tx
    .update(spacePg.interfaces)
    .set({ status: "removed" })
    .where(eq(spacePg.interfaces.id, id))
    .returning({ id: spacePg.interfaces.id });
  if (app.length) return { ok: true };

  const page = await tx
    .update(spacePg.pages)
    .set({ status: "removed" })
    .where(eq(spacePg.pages.id, id))
    .returning({ id: spacePg.pages.id });
  if (page.length === 0) return { ok: false, code: "not_found" };
  return { ok: true };
}

/** Convenience dispatcher used by routes that share one mutate body shape. */
export async function mutateAutomation(
  tx: SpaceTx,
  body:
    | ({ action: "create" } & CreateAutomationInput)
    | ({ action: "update" } & UpdateAutomationInput)
    | { action: "remove"; id: string },
): Promise<CreateResult<AutomationView> | UpdateResult<AutomationView> | RemoveResult> {
  if (body.action === "create") return createAutomation(tx, body);
  if (body.action === "update") return updateAutomation(tx, body);
  if (body.action === "remove") {
    if (typeof body.id !== "string" || !body.id) {
      return { ok: false, code: "invalid_request", message: "id required" };
    }
    return removeAutomation(tx, body.id);
  }
  return { ok: false, code: "invalid_request" };
}

export async function mutateInterface(
  tx: SpaceTx,
  body:
    | ({ action: "create" } & CreateInterfaceInput)
    | ({ action: "update" } & UpdateInterfaceInput)
    | { action: "remove"; id: string },
): Promise<CreateResult<InterfaceView> | UpdateResult<InterfaceView> | RemoveResult> {
  if (body.action === "create") return createInterface(tx, body);
  if (body.action === "update") return updateInterface(tx, body);
  if (body.action === "remove") {
    if (typeof body.id !== "string" || !body.id) {
      return { ok: false, code: "invalid_request", message: "id required" };
    }
    return removeInterface(tx, body.id);
  }
  return { ok: false, code: "invalid_request" };
}

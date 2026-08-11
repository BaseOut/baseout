// Per-Space Schema Docs — Drizzle CRUD over a SpaceTx (Postgres backend).
// openspec/changes/shared-schema-docs §2.
//
// Thin I/O over the shared `spacePg` document tables; the testable decisions
// (excerpt derivation, removed-entity flagging) live in ./documents-logic.ts.
// Runs inside `withSpaceSchema(...)` so the unqualified bo_at_* tables resolve
// into the Space's schema. The Plate `body` and React Flow diagram `state` are
// stored as opaque JSON — never inspected here (no editor-library coupling).

import { and, asc, desc, eq } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import {
  deriveExcerpt,
  entityKey,
  flagRemovedTags,
  type DocTargetType,
} from "./documents-logic";

export interface DocumentTagInput {
  targetType: DocTargetType;
  targetId: string;
  addedVia?: "inline" | "manual" | null;
}
export interface DocumentLinkInput {
  name?: string | null;
  url: string;
  sortOrder?: number;
}
export interface DocumentDiagramInput {
  name?: string | null;
  state: unknown;
  sortOrder?: number;
}
export interface CreateDocumentInput {
  title: string;
  body?: unknown;
  createdByUserId?: string | null;
  tags?: DocumentTagInput[];
  links?: DocumentLinkInput[];
  diagrams?: DocumentDiagramInput[];
}
export interface UpdateDocumentPatch {
  title?: string;
  body?: unknown;
  tags?: DocumentTagInput[];
  links?: DocumentLinkInput[];
  diagrams?: DocumentDiagramInput[];
}

// ───────────────────────── helpers ─────────────────────────

/** Keys (`type:id`) of schema entities that currently exist and are not removed. */
async function loadActiveEntityKeys(tx: SpaceTx): Promise<Set<string>> {
  const [bases, tables, fields, views] = [
    await tx.select({ id: spacePg.bases.baseId, status: spacePg.bases.status }).from(spacePg.bases),
    await tx.select({ id: spacePg.tables.tableId, status: spacePg.tables.status }).from(spacePg.tables),
    await tx.select({ id: spacePg.fields.fieldId, status: spacePg.fields.status }).from(spacePg.fields),
    await tx.select({ id: spacePg.views.viewId, status: spacePg.views.status }).from(spacePg.views),
  ];
  const keys = new Set<string>();
  for (const b of bases) if (b.status !== "removed") keys.add(entityKey("base", b.id));
  for (const t of tables) if (t.status !== "removed") keys.add(entityKey("table", t.id));
  for (const f of fields) if (f.status !== "removed") keys.add(entityKey("field", f.id));
  for (const v of views) if (v.status !== "removed") keys.add(entityKey("view", v.id));
  return keys;
}

async function readTagsForDocument(tx: SpaceTx, documentId: string, activeKeys: Set<string>) {
  const tags = await tx
    .select({
      id: spacePg.documentTags.id,
      documentId: spacePg.documentTags.documentId,
      targetType: spacePg.documentTags.targetType,
      targetId: spacePg.documentTags.targetId,
      addedVia: spacePg.documentTags.addedVia,
    })
    .from(spacePg.documentTags)
    .where(eq(spacePg.documentTags.documentId, documentId));
  return flagRemovedTags(tags, activeKeys);
}

async function readLinks(tx: SpaceTx, documentId: string) {
  return tx
    .select()
    .from(spacePg.documentLinks)
    .where(eq(spacePg.documentLinks.documentId, documentId))
    .orderBy(asc(spacePg.documentLinks.sortOrder));
}

async function readDiagrams(tx: SpaceTx, documentId: string) {
  return tx
    .select()
    .from(spacePg.documentDiagrams)
    .where(eq(spacePg.documentDiagrams.documentId, documentId))
    .orderBy(asc(spacePg.documentDiagrams.sortOrder));
}

async function replaceLinks(tx: SpaceTx, documentId: string, links: DocumentLinkInput[]): Promise<void> {
  await tx.delete(spacePg.documentLinks).where(eq(spacePg.documentLinks.documentId, documentId));
  if (links.length) {
    await tx.insert(spacePg.documentLinks).values(
      links.map((l, i) => ({ documentId, name: l.name ?? null, url: l.url, sortOrder: l.sortOrder ?? i })),
    );
  }
}

async function replaceDiagrams(tx: SpaceTx, documentId: string, diagrams: DocumentDiagramInput[]): Promise<void> {
  await tx.delete(spacePg.documentDiagrams).where(eq(spacePg.documentDiagrams.documentId, documentId));
  if (diagrams.length) {
    await tx.insert(spacePg.documentDiagrams).values(
      diagrams.map((d, i) => ({ documentId, name: d.name ?? null, state: d.state, sortOrder: d.sortOrder ?? i })),
    );
  }
}

async function replaceTags(tx: SpaceTx, documentId: string, tags: DocumentTagInput[]): Promise<void> {
  await tx.delete(spacePg.documentTags).where(eq(spacePg.documentTags.documentId, documentId));
  if (tags.length) {
    await tx.insert(spacePg.documentTags).values(
      tags.map((t) => ({ documentId, targetType: t.targetType, targetId: t.targetId, addedVia: t.addedVia ?? "manual" })),
    );
  }
}

// ───────────────────────── reads ─────────────────────────

/** Docs list for the Docs tab — newest first, with a tag count. */
export async function listDocuments(tx: SpaceTx) {
  const docs = await tx
    .select({
      id: spacePg.documents.id,
      title: spacePg.documents.title,
      excerpt: spacePg.documents.excerpt,
      createdByUserId: spacePg.documents.createdByUserId,
      createdAt: spacePg.documents.createdAt,
      updatedAt: spacePg.documents.updatedAt,
    })
    .from(spacePg.documents)
    .orderBy(desc(spacePg.documents.updatedAt));
  const tags = await tx
    .select({ documentId: spacePg.documentTags.documentId })
    .from(spacePg.documentTags);
  const counts = new Map<string, number>();
  for (const t of tags) counts.set(t.documentId, (counts.get(t.documentId) ?? 0) + 1);
  return docs.map((d) => ({ ...d, tagCount: counts.get(d.id) ?? 0 }));
}

/** Full document (tags flagged, links + diagrams ordered) or null. */
export async function getDocument(tx: SpaceTx, id: string) {
  const [doc] = await tx.select().from(spacePg.documents).where(eq(spacePg.documents.id, id)).limit(1);
  if (!doc) return null;
  const activeKeys = await loadActiveEntityKeys(tx);
  const [tags, links, diagrams] = [
    await readTagsForDocument(tx, id, activeKeys),
    await readLinks(tx, id),
    await readDiagrams(tx, id),
  ];
  return { ...doc, tags, links, diagrams };
}

/** Docs that tag a given schema entity — the Browse-tab detail surfacing. */
export async function readDocsForEntity(tx: SpaceTx, targetType: DocTargetType, targetId: string) {
  const tagged = await tx
    .select({
      documentId: spacePg.documentTags.documentId,
      addedVia: spacePg.documentTags.addedVia,
      title: spacePg.documents.title,
      excerpt: spacePg.documents.excerpt,
    })
    .from(spacePg.documentTags)
    .innerJoin(spacePg.documents, eq(spacePg.documentTags.documentId, spacePg.documents.id))
    .where(
      and(
        eq(spacePg.documentTags.targetType, targetType),
        eq(spacePg.documentTags.targetId, targetId),
      ),
    );
  const activeKeys = await loadActiveEntityKeys(tx);
  return {
    entityRemoved: !activeKeys.has(entityKey(targetType, targetId)),
    documents: tagged,
  };
}

// ───────────────────────── writes ─────────────────────────

export async function createDocument(tx: SpaceTx, input: CreateDocumentInput) {
  const now = new Date();
  const [row] = await tx
    .insert(spacePg.documents)
    .values({
      title: input.title,
      body: (input.body as object | null) ?? null,
      excerpt: deriveExcerpt(input.body),
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: spacePg.documents.id });
  const id = row!.id;
  if (input.tags?.length) await replaceTags(tx, id, input.tags);
  if (input.links?.length) await replaceLinks(tx, id, input.links);
  if (input.diagrams?.length) await replaceDiagrams(tx, id, input.diagrams);
  return getDocument(tx, id);
}

/** Atomic save: updates whichever of title/body/tags/links/diagrams are present. */
export async function updateDocument(tx: SpaceTx, id: string, patch: UpdateDocumentPatch) {
  const [existing] = await tx
    .select({ id: spacePg.documents.id })
    .from(spacePg.documents)
    .where(eq(spacePg.documents.id, id))
    .limit(1);
  if (!existing) return null;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.body !== undefined) {
    set.body = (patch.body as object | null) ?? null;
    set.excerpt = deriveExcerpt(patch.body);
  }
  await tx.update(spacePg.documents).set(set).where(eq(spacePg.documents.id, id));

  if (patch.tags !== undefined) await replaceTags(tx, id, patch.tags);
  if (patch.links !== undefined) await replaceLinks(tx, id, patch.links);
  if (patch.diagrams !== undefined) await replaceDiagrams(tx, id, patch.diagrams);
  return getDocument(tx, id);
}

/** Delete a document and its tags/links/diagrams (cascade within the txn). Returns whether it existed. */
export async function deleteDocument(tx: SpaceTx, id: string): Promise<boolean> {
  await tx.delete(spacePg.documentTags).where(eq(spacePg.documentTags.documentId, id));
  await tx.delete(spacePg.documentLinks).where(eq(spacePg.documentLinks.documentId, id));
  await tx.delete(spacePg.documentDiagrams).where(eq(spacePg.documentDiagrams.documentId, id));
  const deleted = await tx
    .delete(spacePg.documents)
    .where(eq(spacePg.documents.id, id))
    .returning({ id: spacePg.documents.id });
  return deleted.length > 0;
}

/** Add a single tag (idempotent on the (document, type, id) unique index). */
export async function addTag(tx: SpaceTx, documentId: string, tag: DocumentTagInput): Promise<void> {
  await tx
    .insert(spacePg.documentTags)
    .values({ documentId, targetType: tag.targetType, targetId: tag.targetId, addedVia: tag.addedVia ?? "manual" })
    .onConflictDoNothing({
      target: [spacePg.documentTags.documentId, spacePg.documentTags.targetType, spacePg.documentTags.targetId],
    });
}

/** Remove a single tag by its id. Returns whether a row was removed. */
export async function removeTag(tx: SpaceTx, tagId: string): Promise<boolean> {
  const removed = await tx
    .delete(spacePg.documentTags)
    .where(eq(spacePg.documentTags.id, tagId))
    .returning({ id: spacePg.documentTags.id });
  return removed.length > 0;
}

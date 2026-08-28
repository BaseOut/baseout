// Pure logic for the Schema Docs feature (openspec/changes/shared-schema-docs).
//
// Kept free of Drizzle / I/O so it is unit-testable without a per-Space DB
// (the engine test pool hosts no Postgres). The CRUD over a SpaceTx lives in
// ./documents.ts and calls these. Mirrors the schema-diff / space-db-pg split.

/** A schema entity a document can tag. */
export type DocTargetType = "base" | "table" | "field" | "view";

/** Stable key for an entity reference, used to flag removed-entity tags. */
export function entityKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}

/** Concatenate every descendant text node of a Plate node, in order. */
function collectText(node: unknown): string {
  if (node == null || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) return n.children.map(collectText).join("");
  return "";
}

/**
 * Flatten a Plate document `body` to a plain-text snippet for the Docs list /
 * search. Blocks are joined with a space; whitespace is collapsed and trimmed;
 * the result is truncated to `maxLen` with an ellipsis. Non-array / empty
 * bodies yield "". The engine derives this server-side so the client never
 * owns the snippet.
 */
export function deriveExcerpt(body: unknown, maxLen = 200): string {
  if (!Array.isArray(body)) return "";
  const text = body
    .map(collectText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
}

/** A validated tag add/remove request (api-documents-tools tag broker). */
export interface TagRequest {
  targetType: DocTargetType;
  targetId: string;
  addedVia?: "inline" | "manual";
}

const TARGET_TYPES: readonly string[] = ["base", "table", "field", "view"];
const ADDED_VIA: readonly string[] = ["inline", "manual"];

/**
 * Validate a raw tag request (POST body or DELETE query pair). Returns the
 * typed request or null when the shape is invalid — the route maps null → 400.
 */
export function parseTagRequest(raw: unknown): TagRequest | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.targetType !== "string" || !TARGET_TYPES.includes(r.targetType)) return null;
  if (typeof r.targetId !== "string" || r.targetId.trim() === "") return null;
  if (r.addedVia !== undefined && (typeof r.addedVia !== "string" || !ADDED_VIA.includes(r.addedVia))) return null;
  return {
    targetType: r.targetType as DocTargetType,
    targetId: r.targetId,
    ...(r.addedVia !== undefined ? { addedVia: r.addedVia as "inline" | "manual" } : {}),
  };
}

/**
 * Annotate each tag with `entityRemoved` — true when the tagged entity is not
 * in `activeKeys` (absent or `status='removed'`). Tags are never dropped: a
 * reference to a removed entity is retained and shown flagged.
 */
export function flagRemovedTags<T extends { targetType: string; targetId: string }>(
  tags: T[],
  activeKeys: Set<string>,
): (T & { entityRemoved: boolean })[] {
  return tags.map((t) => ({
    ...t,
    entityRemoved: !activeKeys.has(entityKey(t.targetType, t.targetId)),
  }));
}

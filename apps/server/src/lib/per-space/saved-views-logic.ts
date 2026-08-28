// Pure request validation for the saved-views broker (server-saved-views).
// Kept free of Drizzle / I/O so it is unit-testable without a per-Space DB —
// the documents-logic.ts posture. The CRUD over a SpaceTx lives in
// ./saved-views.ts.

/** A validated create request. `config` is opaque (web-owned SerializedConfig). */
export interface SavedViewCreateInput {
  name: string;
  tableId: string;
  config: Record<string, unknown>;
  pinned?: boolean;
  sortOrder?: number;
  createdByUserId?: string | null;
}

/** A validated patch — `tableId` is deliberately absent (immutable, design D3). */
export interface SavedViewPatch {
  name?: string;
  config?: Record<string, unknown>;
  pinned?: boolean;
  sortOrder?: number;
}

export type PatchResult =
  | { ok: true; patch: SavedViewPatch }
  | { ok: false; code: "invalid_request" | "table_locked" };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Validate a create body. Null on any invalid shape (route maps to 400). */
export function parseCreateSavedView(raw: unknown): SavedViewCreateInput | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.name !== "string" || raw.name.trim() === "") return null;
  if (typeof raw.tableId !== "string" || raw.tableId.trim() === "") return null;
  if (!isPlainObject(raw.config)) return null;
  if (raw.pinned !== undefined && typeof raw.pinned !== "boolean") return null;
  if (raw.sortOrder !== undefined && !Number.isInteger(raw.sortOrder)) return null;
  if (raw.createdByUserId !== undefined && raw.createdByUserId !== null && typeof raw.createdByUserId !== "string") return null;
  return {
    name: raw.name.trim(),
    tableId: raw.tableId,
    config: raw.config,
    ...(raw.pinned !== undefined ? { pinned: raw.pinned } : {}),
    ...(raw.sortOrder !== undefined ? { sortOrder: raw.sortOrder as number } : {}),
    ...(raw.createdByUserId !== undefined ? { createdByUserId: raw.createdByUserId as string | null } : {}),
  };
}

/**
 * Validate a patch body. A `tableId` key — even unchanged — is rejected with
 * `table_locked`: the first Save locks a preset's Base + Table (Dan 2026-07-23),
 * enforced here as a server invariant rather than a UI affordance.
 */
export function parsePatchSavedView(raw: unknown): PatchResult {
  if (!isPlainObject(raw)) return { ok: false, code: "invalid_request" };
  if ("tableId" in raw || "table_id" in raw) return { ok: false, code: "table_locked" };
  const patch: SavedViewPatch = {};
  if (raw.name !== undefined) {
    if (typeof raw.name !== "string" || raw.name.trim() === "") return { ok: false, code: "invalid_request" };
    patch.name = raw.name.trim();
  }
  if (raw.config !== undefined) {
    if (!isPlainObject(raw.config)) return { ok: false, code: "invalid_request" };
    patch.config = raw.config;
  }
  if (raw.pinned !== undefined) {
    if (typeof raw.pinned !== "boolean") return { ok: false, code: "invalid_request" };
    patch.pinned = raw.pinned;
  }
  if (raw.sortOrder !== undefined) {
    if (!Number.isInteger(raw.sortOrder)) return { ok: false, code: "invalid_request" };
    patch.sortOrder = raw.sortOrder as number;
  }
  if (!Object.keys(patch).length) return { ok: false, code: "invalid_request" };
  return { ok: true, patch };
}

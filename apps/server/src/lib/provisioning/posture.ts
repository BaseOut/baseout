// Per-Space DB provisioning — pure decisions (no I/O), unit-tested.
//
// Mirrors the design's residency posture + the master-DB CHECK constraints
// (space_databases_backend_check, space_databases_sovereign_requires_records)
// at the application layer, so a bad request is rejected with a typed code
// before any DDL runs. Per openspec/changes/system-per-space-db (design §3).

export type SpaceDbBackend = "d1" | "managed_pg" | "byodb";

export const SPACE_DB_BACKENDS: ReadonlySet<SpaceDbBackend> = new Set([
  "d1",
  "managed_pg",
  "byodb",
]);

export type ResidencyPosture = "managed" | "sovereign";

/**
 * Residency is derived from the backend, never stored:
 *   managed   → d1 | managed_pg (data lives on Baseout infra, encrypted at rest)
 *   sovereign → byodb (schema + records live only in the customer's DB)
 */
export function residencyPosture(backend: SpaceDbBackend): ResidencyPosture {
  return backend === "byodb" ? "sovereign" : "managed";
}

export type ProvisionValidation =
  | { ok: true }
  | { ok: false; code: "invalid_backend" | "sovereign_requires_records" };

/**
 * App-level mirror of the DB CHECKs. Sovereign (byodb) requires a dynamic DB
 * (records_enabled = true) — there is no schema-only sovereign posture.
 */
export function validateProvisionRequest(input: {
  backend: string;
  recordsEnabled: boolean;
}): ProvisionValidation {
  if (!SPACE_DB_BACKENDS.has(input.backend as SpaceDbBackend)) {
    return { ok: false, code: "invalid_backend" };
  }
  if (input.backend === "byodb" && !input.recordsEnabled) {
    return { ok: false, code: "sovereign_requires_records" };
  }
  return { ok: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres schema name for a Space's managed_pg per-Space DB (schema-per-Space
 * on the shared cluster). Derives a safe identifier from the Space UUID —
 * hyphens → underscores, so the result is [a-z0-9_]+ and never needs unsafe
 * quoting. Throws on a non-UUID input (the value is interpolated into DDL, so
 * this is a hard injection guard, not just validation).
 */
export function schemaNameForSpace(spaceId: string): string {
  if (!UUID_RE.test(spaceId)) {
    throw new Error("schemaNameForSpace: spaceId must be a UUID");
  }
  return `bo_space_${spaceId.replace(/-/g, "_")}`;
}

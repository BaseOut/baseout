// Per-Space DB provisioning — orchestration (pure; I/O injected).
//
// The state machine for one Space's per-Space DB:
//   validate posture → (already active? short-circuit) → mark 'provisioning'
//   → run the backend factory → mark 'active' (+ locator) | 'error'.
//
// I/O is behind two narrow interfaces (SpaceDbProvisionWriter + the backend
// factories) so this module is unit-tested with in-memory fakes. The PG-backed
// implementations live in ./provision-pg.ts and are wired by the route.
// Per openspec/changes/system-per-space-db (tasks §2).

import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import {
  validateProvisionRequest,
  type SpaceDbBackend,
} from "./posture";

export interface ProvisionInput {
  spaceId: string;
  /** 'd1' | 'managed_pg' | 'byodb' — validated here, not assumed. */
  backend: string;
  recordsEnabled: boolean;
  provisionedByUserId?: string | null;
}

export type ProvisionResult =
  | {
      ok: true;
      status: "active" | "already_active";
      backend: SpaceDbBackend;
      locator: string | null;
    }
  | {
      ok: false;
      code:
        | "invalid_backend"
        | "sovereign_requires_records"
        | "backend_not_implemented"
        | "provision_failed";
      message?: string;
    };

/** Master-DB row state machine for space_databases (drizzle-backed in prod). */
export interface SpaceDbProvisionWriter {
  /** Current space_databases.status for the Space, or null if no row. */
  getStatus(spaceId: string): Promise<string | null>;
  /** Upsert the row to status='provisioning' with the requested backend. */
  beginProvisioning(input: {
    spaceId: string;
    backend: SpaceDbBackend;
    recordsEnabled: boolean;
    provisionedByUserId?: string | null;
  }): Promise<void>;
  /** Mark active with the backend locator + applied schema version. */
  markActive(input: {
    spaceId: string;
    locator: string | null;
    schemaVersion: number;
  }): Promise<void>;
  /** Mark error with a message. */
  markError(input: { spaceId: string; message: string }): Promise<void>;
}

/** Per-backend "create the database + apply the schema" factories. */
export interface ProvisionBackends {
  /** managed_pg: create the schema-per-Space + apply DDL; returns pg_locator. */
  managedPg: (spaceId: string) => Promise<string>;
  // d1 + byodb factories land when those backends are implemented.
}

export interface ProvisionDeps {
  writer: SpaceDbProvisionWriter;
  backends: ProvisionBackends;
}

export async function provisionSpaceDatabase(
  deps: ProvisionDeps,
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const valid = validateProvisionRequest({
    backend: input.backend,
    recordsEnabled: input.recordsEnabled,
  });
  if (!valid.ok) return valid; // {ok:false, code} — no DB write on a bad request

  const backend = input.backend as SpaceDbBackend;

  // Idempotent: an already-active row means the per-Space DB exists. Re-running
  // would re-create tables and fail; short-circuit instead.
  const existing = await deps.writer.getStatus(input.spaceId);
  if (existing === "active") {
    return { ok: true, status: "already_active", backend, locator: null };
  }

  await deps.writer.beginProvisioning({
    spaceId: input.spaceId,
    backend,
    recordsEnabled: input.recordsEnabled,
    provisionedByUserId: input.provisionedByUserId ?? null,
  });

  if (backend !== "managed_pg") {
    // d1 + byodb are not wired yet (tracer bullet = managed_pg first).
    await deps.writer.markError({
      spaceId: input.spaceId,
      message: `backend_not_implemented:${backend}`,
    });
    return { ok: false, code: "backend_not_implemented" };
  }

  try {
    const locator = await deps.backends.managedPg(input.spaceId);
    await deps.writer.markActive({
      spaceId: input.spaceId,
      locator,
      schemaVersion: SPACE_SCHEMA_VERSION,
    });
    return { ok: true, status: "active", backend, locator };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.writer.markError({ spaceId: input.spaceId, message });
    return { ok: false, code: "provision_failed", message };
  }
}

// ── Deprovision (cleanup fan-out on Space deletion) ──────────────────────────
// system-per-space-db §6.2 (design §"cleanup job owns per-Space teardown"). The
// engine owns the per-Space DB lifecycle, so teardown runs here: drop the
// managed_pg schema (DROP SCHEMA IF EXISTS … CASCADE — idempotent) then delete
// the control-plane space_databases row. Injected I/O so it's unit-tested with
// fakes; the PG-backed deps are wired by the DELETE branch of the
// provision-database route.
//
// d1/byodb teardown is deferred with those backends (needs the Cloudflare D1
// API token / customer DB creds); a row with no locator (never provisioned) is
// dropped without a backend call. The caller for a real Space-delete flow lives
// in apps/web (master DB owns Spaces) — that cross-app wire is the follow-up.

export interface DeprovisionDeps {
  /** Current backend + locator for the Space, or null if there is no row. */
  getRow(spaceId: string): Promise<{ backend: string; locator: string | null } | null>;
  /** Drop the managed_pg schema-per-Space (idempotent DROP SCHEMA … CASCADE). */
  dropManagedPg(spaceId: string): Promise<void>;
  /** Delete the space_databases control-plane row. */
  deleteRow(spaceId: string): Promise<void>;
}

export type DeprovisionResult =
  | { ok: true; status: "deprovisioned" | "not_found" }
  | {
      ok: false;
      code: "backend_not_implemented" | "deprovision_failed";
      message?: string;
    };

export async function deprovisionSpaceDatabase(
  deps: DeprovisionDeps,
  input: { spaceId: string },
): Promise<DeprovisionResult> {
  const row = await deps.getRow(input.spaceId);
  if (!row) return { ok: true, status: "not_found" }; // idempotent: nothing to tear down

  // Never provisioned (pending/error with no locator): just drop the row.
  if (row.locator === null) {
    await deps.deleteRow(input.spaceId);
    return { ok: true, status: "deprovisioned" };
  }

  if (row.backend !== "managed_pg") {
    // d1/byodb teardown needs the backend's own credentials — deferred.
    return {
      ok: false,
      code: "backend_not_implemented",
      message: `teardown for backend '${row.backend}' is not implemented`,
    };
  }

  try {
    await deps.dropManagedPg(input.spaceId);
    await deps.deleteRow(input.spaceId);
    return { ok: true, status: "deprovisioned" };
  } catch (err) {
    return {
      ok: false,
      code: "deprovision_failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

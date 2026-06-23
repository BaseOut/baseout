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

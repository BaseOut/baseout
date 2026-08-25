import { describe, it, expect } from "vitest";
import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import {
  deprovisionSpaceDatabase,
  provisionSpaceDatabase,
  type DeprovisionDeps,
  type SpaceDbProvisionWriter,
} from "../../../src/lib/provisioning/provision";

const SPACE_ID = "11111111-1111-4111-8111-111111111111";

// In-memory fake of the row state machine: records the call sequence + the
// final status, and captures the markActive/markError payloads.
function fakeWriter(initialStatus: string | null = null) {
  const state = {
    calls: [] as string[],
    status: initialStatus,
    lastActive: null as {
      locator: string | null;
      schemaVersion: number;
      backend: string;
    } | null,
    lastError: null as { message: string } | null,
  };
  const writer: SpaceDbProvisionWriter = {
    async getStatus() {
      state.calls.push("getStatus");
      return state.status;
    },
    async beginProvisioning() {
      state.calls.push("beginProvisioning");
      state.status = "provisioning";
    },
    async markActive(input) {
      state.calls.push("markActive");
      state.status = "active";
      state.lastActive = {
        locator: input.locator,
        schemaVersion: input.schemaVersion,
        backend: input.backend,
      };
    },
    async markError(input) {
      state.calls.push("markError");
      state.status = "error";
      state.lastError = { message: input.message };
    },
  };
  return { state, writer };
}

const okManagedPg = (locator = "bo_space_x") => async () => locator;
const throwingManagedPg = (msg: string) => async () => {
  throw new Error(msg);
};

describe("provisionSpaceDatabase", () => {
  it("rejects an invalid backend before any DB write", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg() } },
      { spaceId: SPACE_ID, backend: "sqlite3", recordsEnabled: true },
    );
    expect(res).toEqual({ ok: false, code: "invalid_backend" });
    expect(state.calls).toEqual([]); // no getStatus / begin on a bad request
  });

  it("rejects sovereign without records before any DB write", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg() } },
      { spaceId: SPACE_ID, backend: "byodb", recordsEnabled: false },
    );
    expect(res).toEqual({ ok: false, code: "sovereign_requires_records" });
    expect(state.calls).toEqual([]);
  });

  it("provisions managed_pg: begin → factory → markActive(locator, version)", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg("bo_space_abc") } },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(res).toEqual({
      ok: true,
      status: "active",
      backend: "managed_pg",
      locator: "bo_space_abc",
    });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markActive"]);
    expect(state.lastActive).toEqual({
      locator: "bo_space_abc",
      schemaVersion: SPACE_SCHEMA_VERSION,
      backend: "managed_pg",
    });
  });

  it("provisions d1 when the d1 factory is supplied: begin → factory → markActive", async () => {
    const { state, writer } = fakeWriter();
    const locator = JSON.stringify({
      d1DatabaseId: "22222222-2222-4222-8222-222222222222",
      d1DatabaseName: "baseout-dev-space-x",
    });
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg(), d1: async () => locator } },
      { spaceId: SPACE_ID, backend: "d1", recordsEnabled: true },
    );
    expect(res).toEqual({ ok: true, status: "active", backend: "d1", locator });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markActive"]);
    expect(state.lastActive).toEqual({
      locator,
      schemaVersion: SPACE_SCHEMA_VERSION,
      backend: "d1",
    });
  });

  it("marks error for d1 when the d1 factory throws (provision_failed)", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      {
        writer,
        backends: {
          managedPg: okManagedPg(),
          d1: async () => {
            throw new Error("cf boom");
          },
        },
      },
      { spaceId: SPACE_ID, backend: "d1", recordsEnabled: true },
    );
    expect(res).toEqual({ ok: false, code: "provision_failed", message: "cf boom" });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markError"]);
  });

  it("byodb stays not-implemented even when the d1 factory is supplied", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg(), d1: async () => "x" } },
      { spaceId: SPACE_ID, backend: "byodb", recordsEnabled: true },
    );
    expect(res).toEqual({ ok: false, code: "backend_not_implemented" });
    expect(state.lastError?.message).toContain("backend_not_implemented:byodb");
  });

  it("is idempotent: an already-active row short-circuits", async () => {
    const { state, writer } = fakeWriter("active");
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg() } },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(res).toEqual({
      ok: true,
      status: "already_active",
      backend: "managed_pg",
      locator: null,
    });
    expect(state.calls).toEqual(["getStatus"]); // no begin / factory re-run
  });

  it("marks error when the factory throws", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: throwingManagedPg("boom") } },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(res).toEqual({ ok: false, code: "provision_failed", message: "boom" });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markError"]);
    expect(state.lastError).toEqual({ message: "boom" });
  });

  it("marks error for a not-yet-implemented backend (d1)", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg() } },
      { spaceId: SPACE_ID, backend: "d1", recordsEnabled: true },
    );
    expect(res).toEqual({ ok: false, code: "backend_not_implemented" });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markError"]);
    expect(state.lastError?.message).toContain("backend_not_implemented:d1");
  });

  it("refuses when the isolation gate denies — before any DB write", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      {
        writer,
        backends: { managedPg: okManagedPg() },
        isolationGate: async () => ({ allowed: false, ceiling: "d1" }),
      },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("isolation_above_ceiling");
    expect(state.calls).toEqual([]); // gate denied → no getStatus/begin, nothing written
  });

  it("passes the requested isolation class to the gate and proceeds when allowed", async () => {
    const { state, writer } = fakeWriter();
    let seen: { spaceId: string; requestedClass: string } | undefined;
    const res = await provisionSpaceDatabase(
      {
        writer,
        backends: { managedPg: okManagedPg("bo_space_ok") },
        isolationGate: async (input) => {
          seen = input;
          return { allowed: true, ceiling: "byodb" };
        },
      },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(seen).toEqual({ spaceId: SPACE_ID, requestedClass: "shared_cluster" });
    expect(res).toEqual({
      ok: true,
      status: "active",
      backend: "managed_pg",
      locator: "bo_space_ok",
    });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markActive"]);
  });

  it("proceeds when the gate returns null (fail open — no entitlement resolution)", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      {
        writer,
        backends: { managedPg: okManagedPg("bo_space_open") },
        isolationGate: async () => null,
      },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(res).toEqual({
      ok: true,
      status: "active",
      backend: "managed_pg",
      locator: "bo_space_open",
    });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markActive"]);
  });

  it("proceeds unchanged when no isolationGate is provided (default)", async () => {
    const { state, writer } = fakeWriter();
    const res = await provisionSpaceDatabase(
      { writer, backends: { managedPg: okManagedPg("bo_space_nogate") } },
      { spaceId: SPACE_ID, backend: "managed_pg", recordsEnabled: false },
    );
    expect(res).toEqual({
      ok: true,
      status: "active",
      backend: "managed_pg",
      locator: "bo_space_nogate",
    });
    expect(state.calls).toEqual(["getStatus", "beginProvisioning", "markActive"]);
  });
});

// In-memory fake for the teardown deps: records the call sequence.
function fakeDeprovision(
  row: { backend: string; locator: string | null } | null,
  opts: { dropThrows?: string; withD1?: boolean; d1Throws?: string } = {},
) {
  const state = { calls: [] as string[], d1Locators: [] as string[] };
  const deps: DeprovisionDeps = {
    async getRow() {
      state.calls.push("getRow");
      return row;
    },
    async dropManagedPg() {
      state.calls.push("dropManagedPg");
      if (opts.dropThrows) throw new Error(opts.dropThrows);
    },
    async deleteRow() {
      state.calls.push("deleteRow");
    },
    ...(opts.withD1
      ? {
          deleteD1: async (locator: string) => {
            state.calls.push("deleteD1");
            state.d1Locators.push(locator);
            if (opts.d1Throws) throw new Error(opts.d1Throws);
          },
        }
      : {}),
  };
  return { state, deps };
}

describe("deprovisionSpaceDatabase", () => {
  it("is idempotent: no row → not_found, no teardown calls", async () => {
    const { state, deps } = fakeDeprovision(null);
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res).toEqual({ ok: true, status: "not_found" });
    expect(state.calls).toEqual(["getRow"]);
  });

  it("managed_pg: drops the schema then deletes the row", async () => {
    const { state, deps } = fakeDeprovision({ backend: "managed_pg", locator: "bo_space_abc" });
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res).toEqual({ ok: true, status: "deprovisioned" });
    expect(state.calls).toEqual(["getRow", "dropManagedPg", "deleteRow"]);
  });

  it("never-provisioned row (no locator): deletes the row without a backend drop", async () => {
    const { state, deps } = fakeDeprovision({ backend: "managed_pg", locator: null });
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res).toEqual({ ok: true, status: "deprovisioned" });
    expect(state.calls).toEqual(["getRow", "deleteRow"]); // no dropManagedPg
  });

  it("d1 without a deleteD1 dep: teardown deferred (501), nothing dropped", async () => {
    const { state, deps } = fakeDeprovision({ backend: "d1", locator: "d1-db-123" });
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("backend_not_implemented");
    expect(state.calls).toEqual(["getRow"]); // no drop, no delete
  });

  it("d1 with a deleteD1 dep: deletes the database then the row", async () => {
    const { state, deps } = fakeDeprovision(
      { backend: "d1", locator: "d1-db-123" },
      { withD1: true },
    );
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res).toEqual({ ok: true, status: "deprovisioned" });
    expect(state.calls).toEqual(["getRow", "deleteD1", "deleteRow"]);
    expect(state.d1Locators).toEqual(["d1-db-123"]);
  });

  it("surfaces a D1 delete failure as deprovision_failed and does NOT delete the row", async () => {
    const { state, deps } = fakeDeprovision(
      { backend: "d1", locator: "d1-db-123" },
      { withD1: true, d1Throws: "d1 boom" },
    );
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("deprovision_failed");
      expect(res.message).toBe("d1 boom");
    }
    expect(state.calls).toEqual(["getRow", "deleteD1"]); // deleteRow not reached
  });

  it("surfaces a drop failure as deprovision_failed and does NOT delete the row", async () => {
    const { state, deps } = fakeDeprovision(
      { backend: "managed_pg", locator: "bo_space_abc" },
      { dropThrows: "drop boom" },
    );
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("deprovision_failed");
      expect(res.message).toBe("drop boom");
    }
    expect(state.calls).toEqual(["getRow", "dropManagedPg"]); // deleteRow not reached
  });
});

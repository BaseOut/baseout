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
    lastActive: null as { locator: string | null; schemaVersion: number } | null,
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
      state.lastActive = { locator: input.locator, schemaVersion: input.schemaVersion };
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
    });
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
});

// In-memory fake for the teardown deps: records the call sequence.
function fakeDeprovision(row: { backend: string; locator: string | null } | null, dropThrows?: string) {
  const state = { calls: [] as string[] };
  const deps: DeprovisionDeps = {
    async getRow() {
      state.calls.push("getRow");
      return row;
    },
    async dropManagedPg() {
      state.calls.push("dropManagedPg");
      if (dropThrows) throw new Error(dropThrows);
    },
    async deleteRow() {
      state.calls.push("deleteRow");
    },
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

  it("non-managed backend with a locator: teardown deferred (501), nothing dropped", async () => {
    const { state, deps } = fakeDeprovision({ backend: "d1", locator: "d1-db-123" });
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("backend_not_implemented");
    expect(state.calls).toEqual(["getRow"]); // no drop, no delete
  });

  it("surfaces a drop failure as deprovision_failed and does NOT delete the row", async () => {
    const { state, deps } = fakeDeprovision({ backend: "managed_pg", locator: "bo_space_abc" }, "drop boom");
    const res = await deprovisionSpaceDatabase(deps, { spaceId: SPACE_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("deprovision_failed");
      expect(res.message).toBe("drop boom");
    }
    expect(state.calls).toEqual(["getRow", "dropManagedPg"]); // deleteRow not reached
  });
});

// Pin the column shape of each apps/server schema mirror against the
// canonical apps/web definition. When apps/web's migration changes a
// mirrored column, this test fails until the mirror is updated to match.
//
// We don't mirror every column on every table — only what the engine
// actually reads or writes (see each mirror's header comment). The
// expected-column lists below ARE the contract the engine relies on.

import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";

import {
  backupRuns,
  backupConfigurations,
  backupConfigurationBases,
  atBases,
} from "../../src/db/schema";

describe("schema mirrors", () => {
  it("backup_runs exposes the columns the engine reads + writes", () => {
    expect(Object.keys(getTableColumns(backupRuns)).sort()).toEqual(
      [
        "id",
        "spaceId",
        "connectionId",
        "status",
        "isTrial",
        "recordCount",
        "tableCount",
        "attachmentCount",
        "startedAt",
        "completedAt",
        "errorMessage",
        "triggerRunIds",
        "modifiedAt",
      ].sort(),
    );
  });

  it("backup_configurations exposes mode + storageType (read by run-start)", () => {
    expect(Object.keys(getTableColumns(backupConfigurations)).sort()).toEqual(
      ["id", "spaceId", "mode", "storageType"].sort(),
    );
  });

  it("backup_configuration_bases exposes the join shape (read by run-start)", () => {
    expect(
      Object.keys(getTableColumns(backupConfigurationBases)).sort(),
    ).toEqual(
      ["id", "backupConfigurationId", "atBaseId", "isIncluded"].sort(),
    );
  });

  it("at_bases exposes id, spaceId, atBaseId, name (read by run-start)", () => {
    expect(Object.keys(getTableColumns(atBases)).sort()).toEqual(
      ["id", "spaceId", "atBaseId", "name"].sort(),
    );
  });
});

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
    // Phase B of baseout-backup-schedule-and-cancel: triggeredBy is
    // INSERTed by the SpaceDO alarm with the literal 'scheduled'.
    expect(Object.keys(getTableColumns(backupRuns)).sort()).toEqual(
      [
        "id",
        "spaceId",
        "connectionId",
        "status",
        "triggeredBy",
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

  it("backup_configurations exposes the columns the engine reads + writes", () => {
    // Phase B of baseout-backup-schedule-and-cancel: frequency is read by
    // the SpaceDO alarm; nextScheduledAt is written by the SpaceDO after
    // every alarm-set / alarm-fire. Workspace rediscovery adds
    // autoAddFutureBases — read on alarm + manual rescan.
    expect(Object.keys(getTableColumns(backupConfigurations)).sort()).toEqual(
      [
        "id",
        "spaceId",
        "frequency",
        "mode",
        "storageType",
        "autoAddFutureBases",
        "nextScheduledAt",
      ].sort(),
    );
  });

  it("backup_configuration_bases exposes the join shape (read by run-start) + isAutoDiscovered (written by rediscovery)", () => {
    expect(
      Object.keys(getTableColumns(backupConfigurationBases)).sort(),
    ).toEqual(
      [
        "id",
        "backupConfigurationId",
        "atBaseId",
        "isIncluded",
        "isAutoDiscovered",
      ].sort(),
    );
  });

  it("at_bases exposes the columns the engine reads + writes (incl. rediscovery)", () => {
    expect(Object.keys(getTableColumns(atBases)).sort()).toEqual(
      [
        "id",
        "spaceId",
        "atBaseId",
        "name",
        "discoveredVia",
        "firstSeenAt",
        "lastSeenAt",
      ].sort(),
    );
  });
});

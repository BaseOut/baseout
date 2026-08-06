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
  subscriptions,
  subscriptionItems,
  backupRetentionPolicies,
  healthScoreRules,
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
        // server-backup-scope: stamped by run-start, passed to the task payload.
        "kind",
        "isTrial",
        "recordCount",
        "tableCount",
        "attachmentCount",
        "startedAt",
        // server-run-reconciliation: the sweep reads createdAt as the age anchor
        // for never-started rows. Canonical column: apps/web drizzle 0006.
        "createdAt",
        "completedAt",
        "errorMessage",
        "triggerRunIds",
        // server-retention-and-cleanup: the cleanup pass reads (deleted_at IS NULL
        // filter) and writes (cleanup-complete soft-delete) this column.
        "deletedAt",
        "modifiedAt",
      ].sort(),
    );
  });

  it("backup_retention_policies exposes the full policy the cleanup engine reads", () => {
    // server-retention-and-cleanup: the cleanup pass reads every knob to decide
    // deletions, so the engine mirrors the full table.
    expect(Object.keys(getTableColumns(backupRetentionPolicies)).sort()).toEqual(
      [
        "id",
        "spaceId",
        "policyTier",
        "keepLastN",
        "dailyWindowDays",
        "weeklyWindowDays",
        "monthlyIndefinite",
        "customRules",
        "createdAt",
        "modifiedAt",
      ].sort(),
    );
  });

  it("health_score_rules exposes the catalog columns the engine reads (server-schema-health-scoring)", () => {
    // The engine reads the org-scoped catalog to weight the base grade + label
    // the per-metric breakdown + resolve effective prompts.
    expect(Object.keys(getTableColumns(healthScoreRules)).sort()).toEqual(
      [
        "id",
        "organizationId",
        "code",
        "name",
        "category",
        "severity",
        "weight",
        "enabled",
        "prompt",
        "entityTier",
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
        // web-workspace-bases: standing new-workspaces flag, read by the engine
        // auto-enroll check at run start.
        "autoEnrollNewWorkspaces",
        "nextScheduledAt",
        // server-backup-scope: read by SpaceDO.alarm() (scope, schemaFrequency)
        // + written by the DO (schemaNextScheduledAt).
        "scope",
        "schemaFrequency",
        "schemaNextScheduledAt",
        // server-instant-webhook: DO webhook-poll cadence for frequency='instant'.
        "webhookPollIntervalSeconds",
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
        // server-mcp-workspaces / web-workspace-bases: Airtable workspace identity,
        // stamped by web persistence + engine rediscovery when the MCP listing is
        // available. Canonical migration owned by web-workspace-bases.
        "workspaceId",
        "workspaceName",
      ].sort(),
    );
  });

  it("subscriptions exposes the columns the engine reads (workspace rediscovery tier resolver + usage anchor)", () => {
    // shared-entitlements 3.1/D6: createdAt is the monthly-anniversary anchor for
    // usage metering, read at run-complete finalization.
    expect(Object.keys(getTableColumns(subscriptions)).sort()).toEqual(
      ["id", "organizationId", "status", "createdAt"].sort(),
    );
  });

  it("subscription_items exposes the columns the engine reads (workspace rediscovery tier resolver + entitlement resolution)", () => {
    // shared-entitlements 2.3/4.2: planId is read when resolving DB-native
    // effective entitlements (the migration off `tier`).
    expect(Object.keys(getTableColumns(subscriptionItems)).sort()).toEqual(
      ["id", "subscriptionId", "platformId", "tier", "planId"].sort(),
    );
  });
});

// Pure-logic tests for the per-Space upgrade decision (system-per-space-upgrade).

import { describe, expect, it } from "vitest";
import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import { needsUpgrade, preUpgradeStatements } from "../../../src/lib/provisioning/upgrade";

describe("needsUpgrade", () => {
  it("treats null/undefined (legacy, unrecorded) as behind", () => {
    expect(needsUpgrade(null)).toBe(true);
    expect(needsUpgrade(undefined)).toBe(true);
  });

  it("is false when at the current version", () => {
    expect(needsUpgrade(SPACE_SCHEMA_VERSION)).toBe(false);
  });

  it("is true when behind the current version", () => {
    expect(needsUpgrade(SPACE_SCHEMA_VERSION - 1)).toBe(true);
    expect(needsUpgrade(2)).toBe(true);
  });

  it("is false when at or ahead of the current version", () => {
    expect(needsUpgrade(SPACE_SCHEMA_VERSION + 1)).toBe(false);
  });

  it("honors an explicit target version", () => {
    expect(needsUpgrade(2, 5)).toBe(true);
    expect(needsUpgrade(5, 5)).toBe(false);
    expect(needsUpgrade(4, 5)).toBe(true);
  });
});

describe("preUpgradeStatements (server-interfaces-normalize v7 reshape)", () => {
  const DROP = 'DROP TABLE IF EXISTS "bo_at_interfaces" CASCADE';

  it("drops bo_at_interfaces when upgrading a pre-v7 Space (reshape can't run via CREATE IF NOT EXISTS)", () => {
    expect(preUpgradeStatements(6)).toContain(DROP);
    expect(preUpgradeStatements(2)).toContain(DROP);
  });

  it("treats null/legacy (unrecorded) as pre-v7", () => {
    expect(preUpgradeStatements(null)).toContain(DROP);
    expect(preUpgradeStatements(undefined)).toContain(DROP);
  });

  it("no longer drops bo_at_interfaces once a Space is at v7+", () => {
    expect(preUpgradeStatements(7)).not.toContain(DROP);
    expect(preUpgradeStatements(8)).not.toContain(DROP);
  });
});

describe("preUpgradeStatements (system-per-space-db v8 webhook columns)", () => {
  // Additive COLUMNS on existing tables — CREATE TABLE IF NOT EXISTS skips
  // them, so they need explicit ADD COLUMN IF NOT EXISTS steps.
  const V8_ALTERS = [
    'ALTER TABLE "bo_at_base_runs" ADD COLUMN IF NOT EXISTS "run_type" text DEFAULT \'full\' NOT NULL',
    'ALTER TABLE "bo_at_schema_updates" ADD COLUMN IF NOT EXISTS "action_source" text',
    'ALTER TABLE "bo_at_schema_updates" ADD COLUMN IF NOT EXISTS "actor" text',
    'ALTER TABLE "bo_at_record_updates" ADD COLUMN IF NOT EXISTS "action_source" text',
    'ALTER TABLE "bo_at_record_updates" ADD COLUMN IF NOT EXISTS "actor" text',
  ];

  it("adds the webhook-attribution columns when upgrading a pre-v8 Space", () => {
    for (const stmt of V8_ALTERS) {
      expect(preUpgradeStatements(7)).toContain(stmt);
      expect(preUpgradeStatements(null)).toContain(stmt);
    }
  });

  it("is empty once a Space is at v8+", () => {
    expect(preUpgradeStatements(8)).toEqual([]);
    expect(preUpgradeStatements(9)).toEqual([]);
  });
});

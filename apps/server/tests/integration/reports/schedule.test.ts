import { describe, expect, it } from "vitest";
import {
  eventCadenceForBackupKind,
  reportsToFireAfterBackup,
  dueClockReports,
  type CadenceRef,
  type ClockRef,
} from "../../../src/lib/reports/schedule";

describe("eventCadenceForBackupKind", () => {
  it("maps full → data_backup, schema → schema_backup, else null", () => {
    expect(eventCadenceForBackupKind("full")).toBe("data_backup");
    expect(eventCadenceForBackupKind("schema")).toBe("schema_backup");
    expect(eventCadenceForBackupKind("incremental")).toBeNull();
  });
});

describe("reportsToFireAfterBackup", () => {
  const defs: CadenceRef[] = [
    { id: "a", spaceId: "s1", scheduleCadence: "data_backup", scheduleEnabled: true },
    { id: "b", spaceId: "s1", scheduleCadence: "schema_backup", scheduleEnabled: true },
    { id: "c", spaceId: "s1", scheduleCadence: "data_backup", scheduleEnabled: false },
    { id: "d", spaceId: "s1", scheduleCadence: "weekly", scheduleEnabled: true },
    { id: "e", spaceId: "s1", scheduleCadence: null, scheduleEnabled: true },
  ];

  it("fires only enabled data_backup reports after a full backup", () => {
    expect(reportsToFireAfterBackup(defs, "full")).toEqual([{ id: "a", spaceId: "s1" }]);
  });

  it("fires only enabled schema_backup reports after a schema backup", () => {
    expect(reportsToFireAfterBackup(defs, "schema")).toEqual([{ id: "b", spaceId: "s1" }]);
  });

  it("fires nothing after an incremental backup", () => {
    expect(reportsToFireAfterBackup(defs, "incremental")).toEqual([]);
  });
});

describe("dueClockReports", () => {
  const now = new Date("2026-04-10T10:00:00Z");
  const defs: ClockRef[] = [
    { id: "w1", spaceId: "s1", scheduleCadence: "weekly", scheduleEnabled: true, nextRunAt: new Date("2026-04-10T09:00:00Z") },
    { id: "w2", spaceId: "s1", scheduleCadence: "weekly", scheduleEnabled: true, nextRunAt: new Date("2026-04-11T09:00:00Z") },
    { id: "m1", spaceId: "s2", scheduleCadence: "monthly", scheduleEnabled: true, nextRunAt: new Date("2026-04-10T09:59:00Z") },
    { id: "off", spaceId: "s2", scheduleCadence: "weekly", scheduleEnabled: false, nextRunAt: new Date("2026-01-01T00:00:00Z") },
    { id: "evt", spaceId: "s3", scheduleCadence: "data_backup", scheduleEnabled: true, nextRunAt: null },
  ];

  it("returns only enabled clock reports whose next_run_at has passed", () => {
    const due = dueClockReports(defs, now);
    expect(due.map((d) => d.id).sort()).toEqual(["m1", "w1"]);
  });
});

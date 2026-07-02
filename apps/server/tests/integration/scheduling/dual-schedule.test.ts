// Pure-function tests for the dual (data + schema) schedule decision logic
// (openspec/changes/server-backup-scope). The SpaceDO multiplexes two cadences
// onto its single alarm; these functions own the math so the DO is a thin caller.

import { describe, expect, it } from "vitest";
import { computeNextFire } from "../../../src/lib/scheduling/next-fire";
import {
  asScheduledFrequency,
  computeScheduleFires,
  dueKinds,
  nextAlarm,
  parseScheduleBody,
} from "../../../src/lib/scheduling/dual-schedule";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const ms = (iso: string) => new Date(iso).getTime();

describe("computeScheduleFires", () => {
  it("schema_only → only the schema schedule fires", () => {
    const f = computeScheduleFires(
      { scope: "schema_only", dataFrequency: "monthly", schemaFrequency: "daily" },
      NOW,
    );
    expect(f.dataNextFire).toBeNull(); // schema_only never runs data
    expect(f.schemaNextFire).toBe(computeNextFire("daily", NOW));
  });

  it("schema_and_data with a schema cadence → both fire", () => {
    const f = computeScheduleFires(
      { scope: "schema_and_data", dataFrequency: "monthly", schemaFrequency: "daily" },
      NOW,
    );
    expect(f.dataNextFire).toBe(computeNextFire("monthly", NOW));
    expect(f.schemaNextFire).toBe(computeNextFire("daily", NOW));
  });

  it("schema_and_data without a schema cadence → only data fires", () => {
    const f = computeScheduleFires(
      { scope: "schema_and_data", dataFrequency: "monthly", schemaFrequency: null },
      NOW,
    );
    expect(f.dataNextFire).toBe(computeNextFire("monthly", NOW));
    expect(f.schemaNextFire).toBeNull();
  });

  it("treats 'instant' and null cadences as unscheduled", () => {
    const f = computeScheduleFires(
      { scope: "schema_and_data", dataFrequency: "instant", schemaFrequency: null },
      NOW,
    );
    expect(f.dataNextFire).toBeNull();
    expect(f.schemaNextFire).toBeNull();
  });
});

describe("dueKinds", () => {
  const now = ms("2026-06-15T00:00:00.000Z");
  it("both due at/under now → full + schema", () => {
    expect(
      dueKinds({ dataNextFire: now, schemaNextFire: now - 1000 }, now),
    ).toEqual(["full", "schema"]);
  });
  it("only schema due → schema", () => {
    expect(
      dueKinds({ dataNextFire: now + 5000, schemaNextFire: now }, now),
    ).toEqual(["schema"]);
  });
  it("only data due → full", () => {
    expect(
      dueKinds({ dataNextFire: now, schemaNextFire: now + 5000 }, now),
    ).toEqual(["full"]);
  });
  it("neither due / null → empty", () => {
    expect(dueKinds({ dataNextFire: now + 1, schemaNextFire: now + 1 }, now)).toEqual([]);
    expect(dueKinds({ dataNextFire: null, schemaNextFire: null }, now)).toEqual([]);
  });
});

describe("nextAlarm", () => {
  it("returns the nearer of two fires", () => {
    expect(nextAlarm({ dataNextFire: 200, schemaNextFire: 100 })).toBe(100);
  });
  it("returns the only non-null fire", () => {
    expect(nextAlarm({ dataNextFire: 200, schemaNextFire: null })).toBe(200);
    expect(nextAlarm({ dataNextFire: null, schemaNextFire: 150 })).toBe(150);
  });
  it("returns null when neither is scheduled", () => {
    expect(nextAlarm({ dataNextFire: null, schemaNextFire: null })).toBeNull();
  });
});

describe("asScheduledFrequency", () => {
  it("passes through known cadences", () => {
    expect(asScheduledFrequency("monthly")).toBe("monthly");
    expect(asScheduledFrequency("instant")).toBe("instant");
  });
  it("returns null for unknown / absent", () => {
    expect(asScheduledFrequency("hourly")).toBeNull();
    expect(asScheduledFrequency(null)).toBeNull();
    expect(asScheduledFrequency(undefined)).toBeNull();
  });
});

describe("parseScheduleBody", () => {
  it("parses the new scope shape", () => {
    expect(
      parseScheduleBody({ scope: "schema_and_data", dataFrequency: "monthly", schemaFrequency: "daily" }),
    ).toEqual({ scope: "schema_and_data", dataFrequency: "monthly", schemaFrequency: "daily" });
    expect(parseScheduleBody({ scope: "schema_only", schemaFrequency: "daily" })).toEqual({
      scope: "schema_only",
      dataFrequency: null,
      schemaFrequency: "daily",
    });
  });
  it("parses the legacy { frequency } shape", () => {
    expect(parseScheduleBody({ frequency: "weekly" })).toEqual({
      scope: "schema_and_data",
      dataFrequency: "weekly",
      schemaFrequency: null,
    });
  });
  it("rejects unknown scope, unknown/instant cadence, and empty body", () => {
    expect(parseScheduleBody({})).toBeNull();
    expect(parseScheduleBody({ frequency: "hourly" })).toBeNull();
    expect(parseScheduleBody({ frequency: "instant" })).toBeNull();
    expect(parseScheduleBody({ scope: "nope" })).toBeNull();
    expect(parseScheduleBody({ scope: "schema_and_data", dataFrequency: "instant" })).toBeNull();
    expect(parseScheduleBody(null)).toBeNull();
  });
});

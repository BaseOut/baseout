// Pure-module tests for the Enterprise view-capture gate
// (system-per-space-db §8.2): bo_at_views capture is gated to Airtable
// Enterprise customers — the OAuth-scope-derived is_enterprise_scope flag on
// connections.platform_config (written at Connect time by apps/web). The I/O
// resolver (resolveViewCaptureForRun) is a one-join read exercised by the
// deployed smoke.

import { describe, it, expect } from "vitest";
import {
  isEnterpriseViewCapture,
  resolveViewCaptureSetting,
  shouldSweepUnknownViews,
  stripCapturedViews,
} from "../../../src/lib/per-space/view-capture";
import type { CapturedBase } from "../../../src/lib/per-space/schema-diff";

describe("isEnterpriseViewCapture", () => {
  it("true only when platform_config.is_enterprise_scope === true", () => {
    expect(isEnterpriseViewCapture({ is_enterprise_scope: true })).toBe(true);
  });

  it("false on missing/false/truthy-but-not-true/malformed config (gate defaults closed)", () => {
    expect(isEnterpriseViewCapture({ is_enterprise_scope: false })).toBe(false);
    expect(isEnterpriseViewCapture({ at_user_id: "usr1" })).toBe(false);
    expect(isEnterpriseViewCapture({ is_enterprise_scope: "true" })).toBe(false);
    expect(isEnterpriseViewCapture({ is_enterprise_scope: 1 })).toBe(false);
    expect(isEnterpriseViewCapture(null)).toBe(false);
    expect(isEnterpriseViewCapture(undefined)).toBe(false);
    expect(isEnterpriseViewCapture("enterprise")).toBe(false);
    expect(isEnterpriseViewCapture([])).toBe(false);
  });
});

describe("stripCapturedViews", () => {
  const captured: CapturedBase = {
    baseId: "appX",
    name: "Sales",
    tables: [
      {
        tableId: "tblA",
        name: "Deals",
        fields: [{ fieldId: "fld1", name: "Name", type: "singleLineText" }],
        views: [{ viewId: "viwA", name: "Grid", type: "grid" }],
      },
    ],
  };

  it("empties every table's views (so neither the hash nor the stored schemaJson carries view metadata)", () => {
    const stripped = stripCapturedViews(captured);
    expect(stripped.tables.every((t) => t.views.length === 0)).toBe(true);
    expect(stripped.tables[0]!.fields).toHaveLength(1);
  });

  it("does not mutate the input", () => {
    stripCapturedViews(captured);
    expect(captured.tables[0]!.views).toHaveLength(1);
  });
});

// server-view-capture-override: env-var override + gated-sync unknown-sweep.
describe("resolveViewCaptureSetting", () => {
  it('"1" opens the gate as "override" WITHOUT touching the DB resolver', async () => {
    let resolverCalls = 0;
    const setting = await resolveViewCaptureSetting("1", async () => {
      resolverCalls++;
      return false;
    });
    expect(setting).toBe("override");
    expect(resolverCalls).toBe(0);
  });

  it("unset defers to the resolver and passes its boolean through", async () => {
    expect(await resolveViewCaptureSetting(undefined, async () => true)).toBe(true);
    expect(await resolveViewCaptureSetting(undefined, async () => false)).toBe(false);
  });

  it('any value other than exactly "1" keeps the resolver path unchanged', async () => {
    for (const v of ["0", "true", "", " 1", "yes"]) {
      expect(await resolveViewCaptureSetting(v, async () => false)).toBe(false);
    }
  });
});

describe("shouldSweepUnknownViews", () => {
  it("sweeps only when the gate resolved CLOSED (not Enterprise-open, not override-open)", () => {
    expect(shouldSweepUnknownViews(false)).toBe(true);
    expect(shouldSweepUnknownViews(true)).toBe(false);
    expect(shouldSweepUnknownViews("override")).toBe(false);
  });
});

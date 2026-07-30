// Pure-module tests for the Enterprise view-capture gate
// (system-per-space-db §8.2): bo_at_views capture is gated to Airtable
// Enterprise customers — the OAuth-scope-derived is_enterprise_scope flag on
// connections.platform_config (written at Connect time by apps/web). The I/O
// resolver (resolveViewCaptureForRun) is a one-join read exercised by the
// deployed smoke.

import { describe, it, expect } from "vitest";
import {
  isEnterpriseViewCapture,
  resolveViewCaptureMode,
  resolveViewCaptureSetting,
  shouldSweepUnknownViews,
  stripCapturedViews,
  viewCaptureModeFromConnection,
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

// server-mcp-views: the boolean gate widens to a per-run mode.
describe("viewCaptureModeFromConnection", () => {
  it("'rest' for enterprise-scope connections (today's path)", () => {
    expect(viewCaptureModeFromConnection({ is_enterprise_scope: true })).toBe("rest");
  });

  it("'mcp' for every non-enterprise connection (the widening)", () => {
    expect(viewCaptureModeFromConnection({ is_enterprise_scope: false })).toBe("mcp");
    expect(viewCaptureModeFromConnection({ at_user_id: "usr1" })).toBe("mcp");
    expect(viewCaptureModeFromConnection(null)).toBe("mcp");
  });
});

describe("resolveViewCaptureMode", () => {
  it('override "1" resolves \'rest\' WITHOUT touching the DB resolver (legacy dev escape keeps REST payload views)', async () => {
    let resolverCalls = 0;
    const mode = await resolveViewCaptureMode("1", async () => {
      resolverCalls++;
      return "mcp";
    });
    expect(mode).toBe("rest");
    expect(resolverCalls).toBe(0);
  });

  it("unset/other values defer to the resolver and pass its mode through", async () => {
    expect(await resolveViewCaptureMode(undefined, async () => "mcp")).toBe("mcp");
    expect(await resolveViewCaptureMode("0", async () => "rest")).toBe("rest");
    expect(await resolveViewCaptureMode("", async () => "off")).toBe("off");
  });
});

describe("shouldSweepUnknownViews", () => {
  it("'rest' never sweeps (open gate observes views — pre-change behavior preserved)", () => {
    expect(shouldSweepUnknownViews("rest", true)).toBe(false);
    expect(shouldSweepUnknownViews("rest", false)).toBe(false);
  });

  it("'mcp' sweeps only when NO source sighted views this run", () => {
    expect(shouldSweepUnknownViews("mcp", true)).toBe(false); // capture ok (or REST payload carried views)
    expect(shouldSweepUnknownViews("mcp", false)).toBe(true); // capture failed/absent AND no REST views
  });

  it("'off' always sweeps (we lost visibility)", () => {
    expect(shouldSweepUnknownViews("off", false)).toBe(true);
    expect(shouldSweepUnknownViews("off", true)).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  buildReportEmail,
  deliverReport,
  type DeliverDeps,
  type DeliverInput,
} from "../../../src/lib/reports/delivery";

describe("buildReportEmail", () => {
  it("carries the name, window, and manage link", () => {
    const email = buildReportEmail({
      reportName: "Full Sales Report",
      windowStart: "2026-03-01T00:00:00Z",
      windowEnd: "2026-04-01T00:00:00Z",
      formats: ["pdf", "html"],
      viewUrl: "https://app/spaces/s1/reports/runs/r1",
      manageUrl: "https://app/spaces/s1/reports",
      recipientName: "Dan",
    });
    expect(email.subject).toBe("Report: Full Sales Report (2026-03-01 → 2026-04-01)");
    expect(email.text).toContain("Hi Dan,");
    expect(email.html).toContain("https://app/spaces/s1/reports/runs/r1");
    expect(email.html).toContain("Manage this schedule");
  });

  it("escapes HTML in the report name", () => {
    const email = buildReportEmail({
      reportName: "<script>x</script>",
      windowStart: "2026-03-01T00:00:00Z",
      windowEnd: "2026-04-01T00:00:00Z",
      formats: ["pdf"],
      viewUrl: "https://app/x",
      manageUrl: "https://app/y",
    });
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>x</script>");
  });
});

const baseInput = (over: Partial<DeliverInput> = {}): DeliverInput => ({
  runId: "run-1",
  reportName: "Full Report",
  windowStart: "2026-03-01T00:00:00Z",
  windowEnd: "2026-04-01T00:00:00Z",
  recipients: [{ kind: "member", email: "dan@example.com", name: "Dan" }],
  formats: ["pdf", "html"],
  suppressEmpty: true,
  hadActivity: true,
  viewUrl: "https://app/view",
  manageUrl: "https://app/manage",
  ...over,
});

function makeDeps(over: Partial<DeliverDeps> = {}): DeliverDeps {
  let n = 0;
  return {
    insertDeliveries: vi.fn(async (_runId, rows) =>
      rows.map((r) => ({ id: `d${n++}`, recipientEmail: r.recipientEmail, format: r.format })),
    ),
    sendEmail: vi.fn(async () => {}),
    markDelivery: vi.fn(async () => {}),
    now: () => new Date("2026-04-01T00:00:00Z"),
    ...over,
  };
}

describe("deliverReport", () => {
  it("skips entirely when suppressEmpty and no activity", async () => {
    const deps = makeDeps();
    const res = await deliverReport(baseInput({ hadActivity: false }), deps);
    expect(res).toEqual({ sent: 0, failed: 0, skipped: true });
    expect(deps.insertDeliveries).not.toHaveBeenCalled();
  });

  it("sends one email per recipient, marks all their rows sent", async () => {
    const deps = makeDeps();
    const res = await deliverReport(baseInput(), deps);
    // 1 recipient × 2 formats = 2 rows, 1 email.
    expect(deps.sendEmail).toHaveBeenCalledOnce();
    expect(deps.markDelivery).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ sent: 2, failed: 0, skipped: false });
  });

  it("marks a bouncing recipient's rows failed without affecting others", async () => {
    const deps = makeDeps({
      sendEmail: vi.fn(async ({ to }) => {
        if (to === "bob@example.com") throw new Error("mailbox full");
      }),
    });
    const res = await deliverReport(
      baseInput({
        recipients: [
          { kind: "member", email: "dan@example.com" },
          { kind: "external", email: "bob@example.com" },
        ],
        formats: ["pdf"],
      }),
      deps,
    );
    expect(res).toEqual({ sent: 1, failed: 1, skipped: false });
    const failedCall = (deps.markDelivery as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[1] === "failed",
    );
    expect(failedCall?.[2].error).toBe("mailbox full");
  });
});

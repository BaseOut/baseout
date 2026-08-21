import { describe, expect, it, vi } from "vitest";
import { renderReport, type RenderReportInput } from "../trigger/tasks/render-report";
import type { StorageWriter } from "../trigger/tasks/_lib/storage-writer";
import type { ReportDetail } from "../trigger/tasks/_lib/report-types";

const DOC: ReportDetail = {
  schemaVersion: 1,
  id: "run-1",
  windowStart: "2026-03-01T00:00:00Z",
  windowEnd: "2026-04-01T00:00:00Z",
  generatedAt: "2026-04-01T00:05:00Z",
  generationState: "generated",
  trigger: { kind: "manual" },
  status: "healthy",
  backupsOk: 0,
  backupsFailed: 0,
  delivery: null,
  strip: [],
};

function makeWriter(): StorageWriter {
  return {
    writeCsv: vi.fn(async (key: string) => ({ path: key, size: 0 })),
    writeBlob: vi.fn(async (key: string, body: Uint8Array) => ({ path: key, size: body.length })),
    deletePrefix: vi.fn(async () => ({ deletedCount: 0 })),
  };
}

const baseInput = (over: Partial<RenderReportInput> = {}): RenderReportInput => ({
  runId: "run-1",
  spaceId: "s1",
  document: DOC,
  formats: ["pdf", "html"],
  ...over,
});

describe("renderReport", () => {
  it("renders both formats and returns Space-scoped locations", async () => {
    const writer = makeWriter();
    const renderPdf = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const renderHtml = vi.fn(() => "<html>doc</html>");

    const res = await renderReport(baseInput(), { renderHtml, renderPdf, writer });

    expect(res.status).toBe("rendered");
    expect(res.htmlLocation).toBe("reports/s1/run-1/report.html");
    expect(res.pdfLocation).toBe("reports/s1/run-1/report.pdf");
    expect(renderHtml).toHaveBeenCalledOnce(); // one HTML, reused for the PDF
    expect(renderPdf).toHaveBeenCalledWith("<html>doc</html>");
    expect(writer.writeBlob).toHaveBeenCalledTimes(2);
  });

  it("renders only the requested format", async () => {
    const writer = makeWriter();
    const renderPdf = vi.fn(async () => new Uint8Array([1]));
    const res = await renderReport(baseInput({ formats: ["html"] }), {
      renderHtml: () => "<html>x</html>",
      renderPdf,
      writer,
    });
    expect(res.htmlLocation).toBe("reports/s1/run-1/report.html");
    expect(res.pdfLocation).toBeNull();
    expect(renderPdf).not.toHaveBeenCalled();
    expect(writer.writeBlob).toHaveBeenCalledOnce();
  });

  it("returns status=failed with the error when the PDF renderer throws", async () => {
    const writer = makeWriter();
    const res = await renderReport(baseInput({ formats: ["pdf"] }), {
      renderHtml: () => "<html>x</html>",
      renderPdf: vi.fn(async () => {
        throw new Error("chromium launch failed");
      }),
      writer,
    });
    expect(res.status).toBe("failed");
    expect(res.error).toBe("chromium launch failed");
    expect(res.pdfLocation).toBeNull();
  });
});

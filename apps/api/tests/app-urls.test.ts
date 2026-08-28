// appUrl enrichment (api-search-tools D4): per-hit links on search tools,
// top-level links on entity gets, structural no-ops everywhere else.
import { describe, expect, it } from "vitest";
import { enrichWithAppUrl } from "../src/mcp/app-urls";

const BASE = "https://console.example";

describe("enrichWithAppUrl", () => {
  it("no base or non-object result → untouched", () => {
    const r = { data: [] };
    expect(enrichWithAppUrl("search_records", {}, r, undefined)).toBe(r);
    expect(enrichWithAppUrl("search_records", {}, "text", BASE)).toBe("text");
  });

  it("unknown tools pass through", () => {
    const r = { id: "org_1" };
    expect(enrichWithAppUrl("get_org", {}, r, BASE)).toBe(r);
  });

  it("search_records: every hit gets /data?record=&table=", () => {
    const result = {
      data: [{ baseId: "b1", tables: [{ tableId: "t1", hits: [{ recordId: "rec1", tableId: "t1" }, { recordId: "rec2", tableId: "t1" }] }] }],
      partial: false,
    };
    const out = enrichWithAppUrl("search_records", {}, result, BASE) as typeof result & { data: { tables: { hits: { appUrl?: string }[] }[] }[] };
    const hits = out.data[0]!.tables[0]!.hits;
    expect(hits[0]!.appUrl).toBe(`${BASE}/data?record=rec1&table=t1`);
    expect(hits[1]!.appUrl).toBe(`${BASE}/data?record=rec2&table=t1`);
  });

  it("search_schema hits → /schema?entity=; search_reports → /reports/<id>; search_attachments → asset link", () => {
    const schema = enrichWithAppUrl("search_schema", {}, { data: [{ type: "field", entity: { fieldId: "fld1" } }, { type: "table", entity: { tableId: "tbl1" } }] }, BASE) as { data: { appUrl?: string }[] };
    expect(schema.data[0]!.appUrl).toBe(`${BASE}/schema?entity=fld1`);
    expect(schema.data[1]!.appUrl).toBe(`${BASE}/schema?entity=tbl1`);
    const reports = enrichWithAppUrl("search_reports", {}, { data: [{ id: "r1" }] }, BASE) as { data: { appUrl?: string }[] };
    expect(reports.data[0]!.appUrl).toBe(`${BASE}/reports/r1`);
    const media = enrichWithAppUrl("search_attachments", {}, { data: [{ id: "a1" }] }, BASE) as { data: { appUrl?: string }[] };
    expect(media.data[0]!.appUrl).toBe(`${BASE}/data?tab=attachments&asset=a1`);
  });

  it("entity gets: get_table uses the result/args id", () => {
    const viaResult = enrichWithAppUrl("get_table", { tableId: "t9" }, { id: "t1", name: "T" }, BASE) as { appUrl?: string };
    expect(viaResult.appUrl).toBe(`${BASE}/schema?entity=t1`);
    const viaArgs = enrichWithAppUrl("get_field", { fieldId: "f1" }, { name: "F" }, BASE) as { appUrl?: string };
    expect(viaArgs.appUrl).toBe(`${BASE}/schema?entity=f1`);
  });

  it("documents and backups get page-level links", () => {
    expect((enrichWithAppUrl("get_document", {}, { id: "d1" }, BASE) as { appUrl?: string }).appUrl).toBe(`${BASE}/data?tab=docs`);
    expect((enrichWithAppUrl("get_backup_run", {}, { id: "run1" }, BASE) as { appUrl?: string }).appUrl).toBe(`${BASE}/backups`);
  });

  it("malformed shapes never throw — arrays/holes pass through", () => {
    expect(enrichWithAppUrl("search_records", {}, { data: [null, { tables: "nope" }] }, BASE)).toEqual({ data: [null, { tables: "nope" }] });
    expect(enrichWithAppUrl("search_reports", {}, { data: [{ noId: true }] }, BASE)).toEqual({ data: [{ noId: true }] });
  });
});

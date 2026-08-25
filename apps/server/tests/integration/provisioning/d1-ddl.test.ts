import { describe, expect, it } from "vitest";
import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import { spaceSqliteDdlStatements } from "@baseout/db-schema/space/sqlite-ddl";
import { spaceD1ProvisionStatements } from "../../../src/lib/provisioning/d1-ddl";

const SPACE_ID = "11111111-1111-4111-8111-111111111111";

describe("spaceD1ProvisionStatements", () => {
  it("starts with the bundled sqlite DDL and ends with a meta stamp", () => {
    const stmts = spaceD1ProvisionStatements({ spaceId: SPACE_ID });
    const ddl = spaceSqliteDdlStatements();
    expect(stmts.length).toBe(ddl.length + 1);
    expect(stmts.slice(0, ddl.length).map((s) => s.sql)).toEqual(ddl);
    const stamp = stmts.at(-1)!;
    expect(stamp.sql).toContain("INSERT INTO bo_at_meta");
    expect(stamp.params).toEqual([SPACE_SCHEMA_VERSION, SPACE_ID]);
  });

  it("tracks SPACE_SQLITE_DDL table count (parity with schema module)", () => {
    const creates = spaceD1ProvisionStatements({ spaceId: SPACE_ID }).filter(
      (s) => /CREATE TABLE/i.test(s.sql),
    );
    expect(creates.length).toBe(44);
  });
});

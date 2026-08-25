import { describe, expect, it } from "vitest";
import {
  createD1Database,
  deleteD1Database,
  queryD1,
} from "../../../src/lib/provisioning/d1-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Cloudflare D1 API client", () => {
  it("creates a database and returns uuid + name", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        success: true,
        result: { uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", name: "baseout-dev-space-x" },
      });
    const created = await createD1Database(
      { accountId: "acct", apiToken: "tok", fetchImpl },
      "baseout-dev-space-x",
    );
    expect(created.uuid).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  it("treats already-exists as success and looks up by name", async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async (input) => {
      n += 1;
      const url = String(input);
      if (n === 1) {
        return jsonResponse(
          { success: false, errors: [{ message: "already exists" }] },
          409,
        );
      }
      expect(url).toContain("name=baseout-dev-space-x");
      return jsonResponse({
        success: true,
        result: [
          { uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", name: "baseout-dev-space-x" },
        ],
      });
    };
    const created = await createD1Database(
      { accountId: "acct", apiToken: "tok", fetchImpl },
      "baseout-dev-space-x",
    );
    expect(created.uuid).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(n).toBe(2);
  });

  it("treats 404 on delete as success", async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ success: false }, 404);
    await expect(
      deleteD1Database(
        { accountId: "acct", apiToken: "tok", fetchImpl },
        "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      ),
    ).resolves.toBeUndefined();
  });

  it("maps query errors", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ success: false, errors: [{ message: "no such table" }] }, 400);
    await expect(
      queryD1(
        { accountId: "acct", apiToken: "tok", fetchImpl },
        "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        "SELECT 1",
      ),
    ).rejects.toThrow(/no such table/);
  });
});

import { describe, expect, it } from "vitest";
import { ensureAccountBucket } from "../trigger/tasks/_lib/ensure-account-bucket";

const ORG = "0f8fad5b-d9cb-469f-a165-70867728950e";
const CREDS = {
  accountId: "acct",
  accessKeyId: "key",
  secretAccessKey: "secret",
};

describe("ensureAccountBucket", () => {
  it("PUTs the canonical bucket and returns the name on 200", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(`${init?.method} ${String(input)}`);
      return new Response("", { status: 200 });
    };
    const name = await ensureAccountBucket({
      env: "dev",
      organizationId: ORG,
      creds: CREDS,
      fetchImpl,
      endpoint: "https://example.test",
    });
    expect(name).toBe(`baseout-dev-org-${ORG}`);
    expect(seen[0]).toBe(`PUT https://example.test/baseout-dev-org-${ORG}`);
  });

  it("treats 409 as already-owned success", async () => {
    const fetchImpl: typeof fetch = async () => new Response("BucketAlreadyOwnedByYou", { status: 409 });
    await expect(
      ensureAccountBucket({
        env: "prod",
        organizationId: ORG,
        creds: CREDS,
        fetchImpl,
        endpoint: "https://example.test",
      }),
    ).resolves.toBe(`baseout-prod-org-${ORG}`);
  });

  it("throws on other errors", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("nope", { status: 403 });
    await expect(
      ensureAccountBucket({
        env: "dev",
        organizationId: ORG,
        creds: CREDS,
        fetchImpl,
        endpoint: "https://example.test",
      }),
    ).rejects.toThrow(/403/);
  });
});

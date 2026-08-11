// Bucket-name resolver for managed R2 (system-r2-bucket-topology task 1.1 / T1).
//
// One managed bucket per Org, keyed on the immutable org ID:
//   baseout-{env}-org-{organizationId}
// The result must be a valid R2 account-global bucket name (3–63 chars,
// lowercase, [a-z0-9-], no leading/trailing hyphen). The resolver validates
// its inputs so the composed name is always valid, and re-validates the
// composed result as defense-in-depth.

import { describe, expect, it } from "vitest";
import { resolveManagedBucketName } from "../trigger/tasks/_lib/r2-bucket";

const ORG_UUID = "0f8fad5b-d9cb-469f-a165-70867728950e"; // 36 chars

describe("resolveManagedBucketName", () => {
  it("produces the canonical name for each env with a UUID org id", () => {
    expect(resolveManagedBucketName("dev", ORG_UUID)).toBe(
      `baseout-dev-org-${ORG_UUID}`,
    );
    expect(resolveManagedBucketName("staging", ORG_UUID)).toBe(
      `baseout-staging-org-${ORG_UUID}`,
    );
    expect(resolveManagedBucketName("prod", ORG_UUID)).toBe(
      `baseout-prod-org-${ORG_UUID}`,
    );
  });

  it("keeps the total length within R2's 63-char limit for a 36-char UUID", () => {
    for (const env of ["dev", "staging", "prod"]) {
      const name = resolveManagedBucketName(env, ORG_UUID);
      expect(name.length).toBeLessThanOrEqual(63);
      expect(name.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("emits only R2-legal characters with no leading/trailing hyphen", () => {
    const name = resolveManagedBucketName("prod", ORG_UUID);
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
  });

  it("throws on an empty or whitespace env", () => {
    expect(() => resolveManagedBucketName("", ORG_UUID)).toThrow();
    expect(() => resolveManagedBucketName("   ", ORG_UUID)).toThrow();
  });

  it("throws on an empty or whitespace organizationId", () => {
    expect(() => resolveManagedBucketName("prod", "")).toThrow();
    expect(() => resolveManagedBucketName("prod", "   ")).toThrow();
  });

  it("throws on uppercase characters in either input", () => {
    expect(() => resolveManagedBucketName("Prod", ORG_UUID)).toThrow();
    expect(() =>
      resolveManagedBucketName("prod", ORG_UUID.toUpperCase()),
    ).toThrow();
  });

  it("throws on invalid characters in either input", () => {
    expect(() => resolveManagedBucketName("pr_od", ORG_UUID)).toThrow();
    expect(() => resolveManagedBucketName("prod", "org id")).toThrow();
    expect(() => resolveManagedBucketName("prod", "org.id")).toThrow();
  });
});

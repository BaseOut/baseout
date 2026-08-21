import { describe, expect, it } from "vitest";
import { isAirtableAuthFailureMessage } from "../../src/lib/runs/airtable-auth-failure";

describe("isAirtableAuthFailureMessage", () => {
  it("matches the live INVALID_PERMISSIONS 403 shape from backup-base", () => {
    expect(
      isAirtableAuthFailureMessage(
        'Airtable returned 403: {"error":{"type":"INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND","message":"Invalid permissions, or the requested model was not found.',
      ),
    ).toBe(true);
  });

  it("matches Airtable returned 401", () => {
    expect(isAirtableAuthFailureMessage("Airtable returned 401: unauthorized")).toBe(
      true,
    );
  });

  it("matches early token_403 / token_401 codes", () => {
    expect(isAirtableAuthFailureMessage("token_403")).toBe(true);
    expect(isAirtableAuthFailureMessage("token_401")).toBe(true);
  });

  it("does not match unrelated failures", () => {
    expect(isAirtableAuthFailureMessage("lock_unavailable")).toBe(false);
    expect(isAirtableAuthFailureMessage("missing_r2_creds")).toBe(false);
    expect(isAirtableAuthFailureMessage("Airtable returned 429: rate limit")).toBe(
      false,
    );
    expect(isAirtableAuthFailureMessage(null)).toBe(false);
    expect(isAirtableAuthFailureMessage(undefined)).toBe(false);
    expect(isAirtableAuthFailureMessage("")).toBe(false);
  });
});

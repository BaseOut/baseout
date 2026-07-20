import { describe, expect, it } from "vitest";
import { authorizeGrant, isTokenUsable, type TokenGrant } from "../src/lib/auth";

const now = new Date("2026-07-20T12:00:00.000Z");
const grant = (over: Partial<TokenGrant> = {}): TokenGrant => ({
  id: "tok_1",
  organizationId: "org_1",
  spaceId: null,
  scopes: ["org:read", "backups:read", "schema:read"],
  ...over,
});

describe("isTokenUsable", () => {
  it("accepts an active, unexpired token", () => {
    expect(isTokenUsable({ isActive: true, expiresAt: null }, now)).toBe(true);
    expect(isTokenUsable({ isActive: true, expiresAt: new Date("2027-01-01") }, now)).toBe(true);
  });
  it("rejects inactive or expired tokens", () => {
    expect(isTokenUsable({ isActive: false, expiresAt: null }, now)).toBe(false);
    expect(isTokenUsable({ isActive: true, expiresAt: new Date("2026-01-01") }, now)).toBe(false);
  });
});

describe("authorizeGrant — tenant-safe 404s + scope 403", () => {
  it("allows an org-wide token on any Space in its Org", () => {
    const r = authorizeGrant({ grant: grant(), pathOrgId: "org_1", pathSpaceId: "space_9", requiredScope: "backups:read" });
    expect(r.ok).toBe(true);
  });

  it("404 org_not_found when the path Org ≠ the token's Org (never 403)", () => {
    const r = authorizeGrant({ grant: grant(), pathOrgId: "org_other", requiredScope: "org:read" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.status).toBe(404);
    expect(r.error.code).toBe("org_not_found");
  });

  it("404 space_not_found when a Space-bound token is used on another Space", () => {
    const r = authorizeGrant({ grant: grant({ spaceId: "space_a" }), pathOrgId: "org_1", pathSpaceId: "space_b", requiredScope: "backups:read" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.status).toBe(404);
    expect(r.error.code).toBe("space_not_found");
  });

  it("allows a Space-bound token on its own Space", () => {
    expect(authorizeGrant({ grant: grant({ spaceId: "space_a" }), pathOrgId: "org_1", pathSpaceId: "space_a", requiredScope: "schema:read" }).ok).toBe(true);
  });

  it("403 insufficient_scope when the required scope is missing", () => {
    const r = authorizeGrant({ grant: grant({ scopes: ["backups:read"] }), pathOrgId: "org_1", pathSpaceId: "space_1", requiredScope: "schema:read" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.status).toBe(403);
    expect(r.error.code).toBe("insufficient_scope");
  });

  it("checks Org before scope (mismatched Org on a scoped token → 404, not 403)", () => {
    const r = authorizeGrant({ grant: grant({ scopes: [] }), pathOrgId: "org_other", requiredScope: "org:read" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("org_not_found");
  });
});

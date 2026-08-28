import { describe, expect, it } from "vitest";
import { authorizeGrant, grantFromRow, isTokenUsable, SCOPES, type Scope, type TokenGrant } from "../src/lib/auth";

const now = new Date("2026-07-20T12:00:00.000Z");
const grant = (over: Partial<TokenGrant> = {}): TokenGrant => ({
  id: "tok_1",
  organizationId: "org_1",
  spaceId: null,
  scopes: ["org:read", "backups:read", "schema:read"],
  createdByUserId: null,
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

describe("scope vocabulary (api-write-foundation D2)", () => {
  it("carries exactly the ten scopes", () => {
    expect([...SCOPES].sort()).toEqual(
      ["backups:read", "data:read", "documents:read", "documents:write", "org:read", "reports:read", "reports:write", "schema:read", "views:read", "views:write"].sort(),
    );
  });

  it("each new scope authorizes its own operations", () => {
    for (const scope of ["documents:read", "documents:write", "reports:read", "reports:write", "views:read", "views:write", "data:read"] as Scope[]) {
      const r = authorizeGrant({ grant: grant({ scopes: [scope] }), pathOrgId: "org_1", pathSpaceId: "space_1", requiredScope: scope });
      expect(r.ok, scope).toBe(true);
    }
  });

  it("a :write scope does NOT imply a :read scope (explicit composition)", () => {
    const r = authorizeGrant({ grant: grant({ scopes: ["views:write"] }), pathOrgId: "org_1", pathSpaceId: "space_1", requiredScope: "views:read" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.status).toBe(403);
    expect(r.error.code).toBe("insufficient_scope");
  });

  it("a :read scope does NOT imply its :write scope", () => {
    const r = authorizeGrant({ grant: grant({ scopes: ["views:read"] }), pathOrgId: "org_1", pathSpaceId: "space_1", requiredScope: "views:write" });
    expect(r.ok).toBe(false);
  });

  it("documents:write does NOT imply documents:read (and vice versa)", () => {
    const w = authorizeGrant({ grant: grant({ scopes: ["documents:write"] }), pathOrgId: "org_1", pathSpaceId: "space_1", requiredScope: "documents:read" });
    expect(w.ok).toBe(false);
    const r = authorizeGrant({ grant: grant({ scopes: ["documents:read"] }), pathOrgId: "org_1", pathSpaceId: "space_1", requiredScope: "documents:write" });
    expect(r.ok).toBe(false);
  });
});

describe("grantFromRow — attribution (D5)", () => {
  it("carries the token's creating user id onto the grant", () => {
    const g = grantFromRow({
      id: "tok_1", organizationId: "org_1", spaceId: null,
      scopes: ["documents:write"], createdByUserId: "user_42",
    });
    expect(g.createdByUserId).toBe("user_42");
    expect(g).toEqual({ id: "tok_1", organizationId: "org_1", spaceId: null, scopes: ["documents:write"], createdByUserId: "user_42" });
  });

  it("tolerates a null creator (deleted user — FK is set null)", () => {
    const g = grantFromRow({ id: "t", organizationId: "o", spaceId: "s", scopes: [], createdByUserId: null });
    expect(g.createdByUserId).toBeNull();
  });
});

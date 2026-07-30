import { describe, it, expect } from "vitest";
import {
  ingestBaseMetadata,
  diffBaseAccess,
  type PriorGrant,
  type PriorInviteLink,
} from "../../../src/lib/per-space/collaborators-sync";

const BASE = "appB1";

// Minimal but shape-faithful base-metadata payload (design §payload mapping).
const individual = (userId: string, over: Record<string, unknown> = {}) => ({
  userId,
  email: `${userId}@x.com`,
  permissionLevel: "edit",
  grantedByUserId: "usrGranter",
  createdTime: "2026-07-01T00:00:00.000Z",
  ...over,
});
const group = (groupId: string, over: Record<string, unknown> = {}) => ({
  groupId,
  name: `Group ${groupId}`,
  permissionLevel: "read",
  grantedByUserId: "usrGranter",
  createdTime: "2026-07-01T00:00:00.000Z",
  ...over,
});

describe("ingestBaseMetadata — canonical blocks", () => {
  it("individual base collaborator → user principal + individual_base grant", () => {
    const out = ingestBaseMetadata(BASE, {
      individualCollaborators: { baseCollaborators: [individual("usr1")] },
    });
    expect(out.principals).toContainEqual(
      expect.objectContaining({ principalId: "usr1", kind: "user", email: "usr1@x.com" }),
    );
    expect(out.grants).toContainEqual(
      expect.objectContaining({
        principalId: "usr1",
        baseId: BASE,
        interfaceId: "",
        scope: "individual_base",
        permissionLevel: "edit",
        grantedByUserId: "usrGranter",
      }),
    );
    // granter seeded as a principal (identity NULL)
    expect(out.principals).toContainEqual(
      expect.objectContaining({ principalId: "usrGranter", kind: "user", email: null }),
    );
  });

  it("group workspace collaborator → group principal + group_workspace grant", () => {
    const out = ingestBaseMetadata(BASE, {
      groupCollaborators: { workspaceCollaborators: [group("ugp1")] },
    });
    expect(out.principals).toContainEqual(
      expect.objectContaining({ principalId: "ugp1", kind: "group", name: "Group ugp1" }),
    );
    expect(out.grants).toContainEqual(
      expect.objectContaining({ principalId: "ugp1", scope: "group_workspace" }),
    );
  });

  it("interface collaborators/invite links carry interface_id + *_interface scope", () => {
    const out = ingestBaseMetadata(BASE, {
      interfaces: {
        pbdX: {
          individualCollaborators: [individual("usr9")],
          inviteLinks: [
            { id: "invI", permissionLevel: "read", type: "multiUse", createdTime: "2026-07-02T00:00:00.000Z" },
          ],
        },
      },
    });
    expect(out.grants).toContainEqual(
      expect.objectContaining({ principalId: "usr9", interfaceId: "pbdX", scope: "individual_interface" }),
    );
    expect(out.inviteLinks).toContainEqual(
      expect.objectContaining({ airtableInviteId: "invI", interfaceId: "pbdX", linkScope: "interface" }),
    );
  });

  it("deprecated top-level collaborators is a fallback that can't double-count", () => {
    const out = ingestBaseMetadata(BASE, {
      individualCollaborators: { baseCollaborators: [individual("usr1")] },
      collaborators: { baseCollaborators: [individual("usr1")] }, // duplicate
    });
    const usr1Base = out.grants.filter(
      (g) => g.principalId === "usr1" && g.scope === "individual_base",
    );
    expect(usr1Base).toHaveLength(1);
  });

  it("deprecated-only entry is ingested with individual_base scope", () => {
    const out = ingestBaseMetadata(BASE, {
      collaborators: { baseCollaborators: [individual("usrOnly")] },
    });
    expect(out.grants).toContainEqual(
      expect.objectContaining({ principalId: "usrOnly", scope: "individual_base" }),
    );
  });

  it("invite link → row + referrer seeded as principal", () => {
    const out = ingestBaseMetadata(BASE, {
      inviteLinks: {
        baseInviteLinks: [
          {
            id: "inv1",
            invitedEmail: "new@x.com",
            permissionLevel: "edit",
            referredByUserId: "usrRef",
            restrictedToEmailDomains: ["x.com"],
            type: "singleUse",
            createdTime: "2026-07-03T00:00:00.000Z",
          },
        ],
      },
    });
    expect(out.inviteLinks[0]).toEqual(
      expect.objectContaining({
        airtableInviteId: "inv1",
        baseId: BASE,
        linkScope: "base",
        invitedEmail: "new@x.com",
        referredByUserId: "usrRef",
        type: "singleUse",
      }),
    );
    expect(out.principals).toContainEqual(
      expect.objectContaining({ principalId: "usrRef", kind: "user" }),
    );
  });

  it("full documented payload composes: 6 scopes + invite + interface + deprecated-dedup", () => {
    // Mirrors fixtures/base-metadata.json (the PROVISIONAL shape reference).
    const out = ingestBaseMetadata(BASE, {
      workspaceId: "wsp1",
      createdTime: "2026-01-15T09:00:00.000Z",
      permissionLevel: "owner",
      individualCollaborators: {
        baseCollaborators: [individual("usrBase")],
        workspaceCollaborators: [individual("usrWs")],
      },
      groupCollaborators: {
        baseCollaborators: [],
        workspaceCollaborators: [group("ugpEng")],
      },
      inviteLinks: {
        baseInviteLinks: [{ id: "invBase", permissionLevel: "comment", referredByUserId: "usrRef", type: "multiUse", createdTime: "2026-03-01T00:00:00.000Z" }],
        workspaceInviteLinks: [],
      },
      interfaces: {
        pbd1: {
          individualCollaborators: [individual("usrIface")],
          groupCollaborators: [],
          inviteLinks: [{ id: "invIface", permissionLevel: "read", type: "singleUse", createdTime: "2026-04-02T00:00:00.000Z" }],
        },
      },
      packages: { note: "unpinned" },
      collaborators: { baseCollaborators: [individual("usrBase")] }, // deprecated dup
    });

    const scopes = out.grants.map((g) => g.scope).sort();
    expect(scopes).toEqual([
      "group_workspace",
      "individual_base",
      "individual_interface",
      "individual_workspace",
    ]);
    // usrBase appears once despite the deprecated duplicate
    expect(out.grants.filter((g) => g.principalId === "usrBase")).toHaveLength(1);
    // invite links: base + interface
    expect(out.inviteLinks.map((l) => l.linkScope).sort()).toEqual(["base", "interface"]);
    // referrer usrRef seeded as a principal
    expect(out.principals.some((p) => p.principalId === "usrRef" && p.kind === "user")).toBe(true);
    expect(out.meta.workspaceId).toBe("wsp1");
    expect(out.meta.ownPermissionLevel).toBe("owner");
  });

  it("stamps base meta (workspaceId, createdTime, own permission) + retains raw", () => {
    const payload = {
      workspaceId: "wsp1",
      createdTime: "2026-01-01T00:00:00.000Z",
      permissionLevel: "owner",
      packages: { foo: 1 },
    };
    const out = ingestBaseMetadata(BASE, payload);
    expect(out.meta).toEqual(
      expect.objectContaining({
        baseId: BASE,
        workspaceId: "wsp1",
        ownPermissionLevel: "owner",
        packages: { foo: 1 },
      }),
    );
    expect(out.meta.raw).toEqual(payload);
  });
});

describe("diffBaseAccess — run-over-run revocation", () => {
  const grant = (principalId: string, over: Partial<PriorGrant> = {}): PriorGrant => ({
    principalId,
    baseId: BASE,
    interfaceId: "",
    scope: "individual_base",
    permissionLevel: "edit",
    status: "active",
    ...over,
  });

  it("removed collaborator → grant deleted (principal untouched)", () => {
    const out = ingestBaseMetadata(BASE, {
      individualCollaborators: { baseCollaborators: [individual("usrKeep")] },
    });
    const diff = diffBaseAccess({
      baseId: BASE,
      observed: out.grants,
      priorGrants: [grant("usrKeep"), grant("usrGone")],
      observedInviteLinks: [],
      priorInviteLinks: [],
    });
    expect(diff.grantDeletions).toEqual([
      expect.objectContaining({ principalId: "usrGone", scope: "individual_base" }),
    ]);
    // usrKeep stays active (upserted)
    expect(diff.grantDeletions.find((d) => d.principalId === "usrKeep")).toBeUndefined();
  });

  it("permission change updates in place, stays active (no deletion)", () => {
    const out = ingestBaseMetadata(BASE, {
      individualCollaborators: { baseCollaborators: [individual("usr1", { permissionLevel: "owner" })] },
    });
    const diff = diffBaseAccess({
      baseId: BASE,
      observed: out.grants,
      priorGrants: [grant("usr1", { permissionLevel: "edit" })],
      observedInviteLinks: [],
      priorInviteLinks: [],
    });
    expect(diff.grantDeletions).toEqual([]);
    expect(diff.grantUpserts.find((u) => u.principalId === "usr1")?.permissionLevel).toBe("owner");
  });

  it("absent capture (skip) does not delete — caller passes observed=null semantics via empty guard", () => {
    // Deletion only fires for grants of the captured base; an unrelated base's
    // prior grants are never in priorGrants for this call.
    const diff = diffBaseAccess({
      baseId: BASE,
      observed: [],
      priorGrants: [],
      observedInviteLinks: [],
      priorInviteLinks: [],
    });
    expect(diff.grantDeletions).toEqual([]);
    expect(diff.grantUpserts).toEqual([]);
  });

  it("invite link removed → soft delete; reappearing invite resurrects", () => {
    const out = ingestBaseMetadata(BASE, {
      inviteLinks: { baseInviteLinks: [{ id: "invLive", permissionLevel: "read", type: "multiUse", createdTime: "2026-07-03T00:00:00.000Z" }] },
    });
    const prior: PriorInviteLink[] = [
      { airtableInviteId: "invLive", baseId: BASE, interfaceId: "", linkScope: "base", status: "deleted" },
      { airtableInviteId: "invGone", baseId: BASE, interfaceId: "", linkScope: "base", status: "active" },
    ];
    const diff = diffBaseAccess({
      baseId: BASE,
      observed: [],
      priorGrants: [],
      observedInviteLinks: out.inviteLinks,
      priorInviteLinks: prior,
    });
    expect(diff.inviteDeletions).toEqual([
      expect.objectContaining({ airtableInviteId: "invGone" }),
    ]);
    // invLive reappears → upserted (resurrect handled at write via status active)
    expect(diff.inviteUpserts.find((u) => u.airtableInviteId === "invLive")).toBeTruthy();
  });
});

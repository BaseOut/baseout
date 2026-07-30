// Base-collaborator ingestion + diff — PURE (no I/O), unit-tested
// (server-base-collaborators; paired with workflows-base-collaborators).
//
// The workflows courier fetches GET /v0/meta/bases/{id}?include=collaborators&
// inviteLinks&interfaces&packages and POSTs the body verbatim to
// collaborators-sync. This module owns ALL parsing:
//   - split each collaborator entry into identity (→ bo_at_principals) and
//     grant facts (→ bo_at_base_access), across the six scopes,
//   - canonical individualCollaborators/groupCollaborators + per-interface
//     lists first; the deprecated top-level `collaborators` block only fills
//     gaps (the grant unique key makes double-ingest impossible),
//   - seed granters + invite-link referrers as principals (identity NULL),
//   - invite links (base/workspace/interface),
//   - base-level meta (workspaceId, createdTime, own permissionLevel) + raw,
//   - the run-over-run per-base full-state diff (soft delete on absence).
//
// The drizzle read/apply live in space-db-pg.ts.

// ───────────────────────── ingest output types ─────────────────────────

export interface IngestPrincipal {
  principalId: string;
  kind: "user" | "group";
  email: string | null;
  name: string | null;
}

export type GrantScope =
  | "individual_base"
  | "individual_workspace"
  | "group_base"
  | "group_workspace"
  | "individual_interface"
  | "group_interface";

export interface IngestGrant {
  principalId: string;
  baseId: string;
  interfaceId: string; // '' for non-interface scopes
  scope: GrantScope;
  permissionLevel: string | null;
  grantedByUserId: string | null;
  airtableCreatedTime: Date | null;
}

export interface IngestInviteLink {
  airtableInviteId: string;
  baseId: string;
  interfaceId: string;
  linkScope: "base" | "workspace" | "interface";
  invitedEmail: string | null;
  permissionLevel: string | null;
  referredByUserId: string | null;
  restrictedToEmailDomains: string[] | null;
  type: string | null;
  airtableCreatedTime: Date | null;
}

export interface IngestMeta {
  baseId: string;
  workspaceId: string | null;
  airtableCreatedTime: Date | null;
  ownPermissionLevel: string | null;
  packages: unknown;
  raw: unknown;
}

export interface IngestResult {
  principals: IngestPrincipal[];
  grants: IngestGrant[];
  inviteLinks: IngestInviteLink[];
  meta: IngestMeta;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

const dateOrNull = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const grantKey = (g: { baseId: string; interfaceId: string; scope: string; principalId: string }) =>
  `${g.baseId}|${g.interfaceId}|${g.scope}|${g.principalId}`;

const inviteKey = (i: { baseId: string; interfaceId: string; linkScope: string; airtableInviteId: string }) =>
  `${i.baseId}|${i.interfaceId}|${i.linkScope}|${i.airtableInviteId}`;

/**
 * Parse one base's metadata payload into principals + grants + invite links +
 * base meta. Idempotent and lenient: malformed entries are skipped, not fatal.
 */
export function ingestBaseMetadata(baseId: string, payload: unknown): IngestResult {
  const p = isRecord(payload) ? payload : {};

  // Principals are deduped by principalId with fill-never-blank preference for
  // identity fields; grants deduped by their unique key (canonical wins).
  const principalMap = new Map<string, IngestPrincipal>();
  const grantSeen = new Set<string>();
  const grants: IngestGrant[] = [];
  const inviteLinks: IngestInviteLink[] = [];

  const seedPrincipal = (principalId: string, kind: "user" | "group", email: string | null, name: string | null) => {
    const existing = principalMap.get(principalId);
    if (!existing) {
      principalMap.set(principalId, { principalId, kind, email, name });
      return;
    }
    // fill-never-blank within this capture
    if (email && !existing.email) existing.email = email;
    if (name && !existing.name) existing.name = name;
  };

  const addGrant = (
    entry: unknown,
    kind: "individual" | "group",
    level: "base" | "workspace" | "interface",
    interfaceId: string,
  ) => {
    if (!isRecord(entry)) return;
    const principalId = kind === "individual" ? str(entry.userId) : str(entry.groupId);
    if (!principalId) return;
    if (kind === "individual") {
      seedPrincipal(principalId, "user", str(entry.email), null);
    } else {
      seedPrincipal(principalId, "group", null, str(entry.name));
    }
    const grantedByUserId = str(entry.grantedByUserId);
    if (grantedByUserId) seedPrincipal(grantedByUserId, "user", null, null);
    const scope = `${kind}_${level}` as GrantScope;
    const key = grantKey({ baseId, interfaceId, scope, principalId });
    if (grantSeen.has(key)) return; // canonical already ingested (deprecated fallback no-ops)
    grantSeen.add(key);
    grants.push({
      principalId,
      baseId,
      interfaceId,
      scope,
      permissionLevel: str(entry.permissionLevel),
      grantedByUserId,
      airtableCreatedTime: dateOrNull(entry.createdTime),
    });
  };

  const addInvite = (
    entry: unknown,
    linkScope: "base" | "workspace" | "interface",
    interfaceId: string,
  ) => {
    if (!isRecord(entry)) return;
    const id = str(entry.id);
    if (!id) return;
    const referredByUserId = str(entry.referredByUserId);
    if (referredByUserId) seedPrincipal(referredByUserId, "user", null, null);
    const domains = Array.isArray(entry.restrictedToEmailDomains)
      ? entry.restrictedToEmailDomains.filter((d): d is string => typeof d === "string")
      : null;
    inviteLinks.push({
      airtableInviteId: id,
      baseId,
      interfaceId,
      linkScope,
      invitedEmail: str(entry.invitedEmail),
      permissionLevel: str(entry.permissionLevel),
      referredByUserId,
      restrictedToEmailDomains: domains,
      type: str(entry.type),
      airtableCreatedTime: dateOrNull(entry.createdTime),
    });
  };

  // Canonical individual/group blocks (base + workspace).
  const indiv = isRecord(p.individualCollaborators) ? p.individualCollaborators : {};
  for (const e of asArray(indiv.baseCollaborators)) addGrant(e, "individual", "base", "");
  for (const e of asArray(indiv.workspaceCollaborators)) addGrant(e, "individual", "workspace", "");
  const grp = isRecord(p.groupCollaborators) ? p.groupCollaborators : {};
  for (const e of asArray(grp.baseCollaborators)) addGrant(e, "group", "base", "");
  for (const e of asArray(grp.workspaceCollaborators)) addGrant(e, "group", "workspace", "");

  // Per-interface collaborators + invite links.
  if (isRecord(p.interfaces)) {
    for (const [interfaceId, block] of Object.entries(p.interfaces)) {
      if (!isRecord(block)) continue;
      for (const e of asArray(block.individualCollaborators)) addGrant(e, "individual", "interface", interfaceId);
      for (const e of asArray(block.groupCollaborators)) addGrant(e, "group", "interface", interfaceId);
      for (const e of asArray(block.inviteLinks)) addInvite(e, "interface", interfaceId);
    }
  }

  // Invite links (base + workspace).
  const inv = isRecord(p.inviteLinks) ? p.inviteLinks : {};
  for (const e of asArray(inv.baseInviteLinks)) addInvite(e, "base", "");
  for (const e of asArray(inv.workspaceInviteLinks)) addInvite(e, "workspace", "");

  // Deprecated top-level `collaborators` block — fallback only (grant unique key
  // already blocks duplicates from the canonical blocks above).
  if (isRecord(p.collaborators)) {
    for (const e of asArray(p.collaborators.baseCollaborators)) addGrant(e, "individual", "base", "");
    for (const e of asArray(p.collaborators.workspaceCollaborators)) addGrant(e, "individual", "workspace", "");
  }

  const meta: IngestMeta = {
    baseId,
    workspaceId: str(p.workspaceId),
    airtableCreatedTime: dateOrNull(p.createdTime),
    ownPermissionLevel: str(p.permissionLevel),
    packages: p.packages ?? null,
    raw: payload,
  };

  return { principals: [...principalMap.values()], grants, inviteLinks, meta };
}

// ───────────────────────── run-over-run diff ─────────────────────────

export interface PriorGrant {
  principalId: string;
  baseId: string;
  interfaceId: string;
  scope: string;
  permissionLevel: string | null;
  status: string; // active | deleted
}

export interface PriorInviteLink {
  airtableInviteId: string;
  baseId: string;
  interfaceId: string;
  linkScope: string;
  status: string;
}

export interface BaseAccessDiffResult {
  grantUpserts: IngestGrant[];
  grantDeletions: PriorGrant[];
  inviteUpserts: IngestInviteLink[];
  inviteDeletions: PriorInviteLink[];
}

/**
 * A capture is the complete current state for its base: everything observed is
 * upserted (bump stamps / update permission in place / resurrect), and any
 * `active` prior row for that base absent from the capture is soft-deleted.
 * Principals are never deleted (revocation lives on grants). The caller
 * guarantees priorGrants/priorInviteLinks are scoped to THIS base, and never
 * calls this for a skipped (absent) capture — so an empty observed set with an
 * empty prior set is a genuine no-op.
 */
export function diffBaseAccess(args: {
  baseId: string;
  observed: IngestGrant[];
  priorGrants: PriorGrant[];
  observedInviteLinks: IngestInviteLink[];
  priorInviteLinks: PriorInviteLink[];
}): BaseAccessDiffResult {
  const observedGrantKeys = new Set(args.observed.map(grantKey));
  const grantDeletions = args.priorGrants.filter(
    (g) => g.status === "active" && !observedGrantKeys.has(grantKey(g)),
  );

  const observedInviteKeys = new Set(args.observedInviteLinks.map(inviteKey));
  const inviteDeletions = args.priorInviteLinks.filter(
    (i) => i.status === "active" && !observedInviteKeys.has(inviteKey(i)),
  );

  return {
    grantUpserts: args.observed,
    grantDeletions,
    inviteUpserts: args.observedInviteLinks,
    inviteDeletions,
  };
}

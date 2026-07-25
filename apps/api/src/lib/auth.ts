// Bearer-token auth (rest-read-api). The pure pieces (token usability, tenant +
// scope authorization) are unit-tested; the DB lookup + write-behind last_used_at
// are the thin IO layer. Tenant-safe: org/space mismatch → 404 (never 403), so
// the existence of other tenants' ids is never confirmed; a missing scope → 403.

import { eq } from "drizzle-orm";
import { hashApiToken, parseBearerToken } from "@baseout/shared/api-tokens";
import type { ApiDb } from "../db/client";
import { apiTokens } from "../db/schema";
import { ApiError, insufficientScope, notFound } from "./errors";

export type Scope = "org:read" | "backups:read" | "schema:read";

export interface TokenGrant {
  id: string;
  organizationId: string;
  spaceId: string | null;
  scopes: string[];
}

/** Pure: usable right now? (active + unexpired). */
export function isTokenUsable(row: { isActive: boolean; expiresAt: Date | null }, now: Date): boolean {
  if (!row.isActive) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export type AuthzResult = { ok: true } | { ok: false; error: ApiError };

/**
 * Pure tenant + scope decision for an authenticated request.
 * - path {orgId} ≠ token's Org → 404 org_not_found
 * - Space-bound token used on a different Space → 404 space_not_found
 * - required scope not granted → 403 insufficient_scope
 * (Whether {spaceId} actually exists inside the Org is a DB check in the handler,
 *  which also returns 404 space_not_found — same code, no tenant leak.)
 */
export function authorizeGrant(args: {
  grant: TokenGrant;
  pathOrgId: string;
  pathSpaceId?: string | null;
  requiredScope: Scope;
}): AuthzResult {
  const { grant, pathOrgId, pathSpaceId, requiredScope } = args;
  if (pathOrgId !== grant.organizationId) {
    return { ok: false, error: notFound("org_not_found", "Organization not found.") };
  }
  if (pathSpaceId != null && grant.spaceId != null && grant.spaceId !== pathSpaceId) {
    return { ok: false, error: notFound("space_not_found", "Space not found.") };
  }
  if (!grant.scopes.includes(requiredScope)) {
    return { ok: false, error: insufficientScope(requiredScope) };
  }
  return { ok: true };
}

/** IO: parse → SHA-256 → row lookup → usability. Returns the grant or null (→ 401). */
export async function authenticate(db: ApiDb, authHeader: string | null, now: Date): Promise<TokenGrant | null> {
  const token = parseBearerToken(authHeader);
  if (!token) return null;
  const hash = await hashApiToken(token);
  const [row] = await db
    .select({
      id: apiTokens.id,
      organizationId: apiTokens.organizationId,
      spaceId: apiTokens.spaceId,
      scopes: apiTokens.scopes,
      isActive: apiTokens.isActive,
      expiresAt: apiTokens.expiresAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash))
    .limit(1);
  if (!row || !isTokenUsable(row, now)) return null;
  return { id: row.id, organizationId: row.organizationId, spaceId: row.spaceId, scopes: row.scopes };
}

/** Write-behind last_used_at (call via ctx.waitUntil — MUST NOT block the response). */
export async function touchLastUsed(db: ApiDb, tokenId: string, now: Date): Promise<void> {
  await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, tokenId));
}

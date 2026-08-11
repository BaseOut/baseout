/**
 * Engine-side deps for the AI-routing seam (shared-ai-byok task 3.1). These are
 * the real implementations of `ResolveAiRoutingDeps` (see resolve-ai-routing.ts):
 * `isByokEntitled` (does the plan grant `byo_ai_key`) + `findActiveKey` (the
 * org's active key facts — NO secret material; the ciphertext is only decrypted
 * over the gated credential endpoint, task 3.3).
 *
 * `byokEntitledFrom` is the pure decision (unit-tested); the two exported async
 * helpers are the thin DB wrappers the call sites assemble.
 */

import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import { aiProviderKeys } from "../../db/schema";
import { getBool, type EntitlementMap } from "@baseout/db-schema";
import { resolveEntitlements } from "../entitlements/resolve";
import type { ActiveProviderKey } from "./resolve-ai-routing";

/**
 * Pure: does the resolved plan grant `byo_ai_key`? A null resolution (no active
 * plan), a missing feature, or a non-boolean value all resolve to `false` — BYOK
 * never widens scope on a resolution gap.
 */
export function byokEntitledFrom(
  resolution: { entitlements: EntitlementMap } | null,
): boolean {
  if (!resolution) return false;
  try {
    return getBool(resolution.entitlements, "byo_ai_key");
  } catch {
    return false;
  }
}

export async function isByokEntitled(
  db: AppDb,
  organizationId: string,
): Promise<boolean> {
  return byokEntitledFrom(await resolveEntitlements(db, organizationId));
}

/** The active BYOK key's facts for an org, or null. Carries no key material. */
export async function findActiveKey(
  db: AppDb,
  organizationId: string,
): Promise<ActiveProviderKey | null> {
  const [row] = await db
    .select({
      provider: aiProviderKeys.provider,
      modelDefault: aiProviderKeys.modelDefault,
    })
    .from(aiProviderKeys)
    .where(
      and(
        eq(aiProviderKeys.organizationId, organizationId),
        eq(aiProviderKeys.status, "active"),
      ),
    )
    .orderBy(desc(aiProviderKeys.modifiedAt))
    .limit(1);
  return row ?? null;
}

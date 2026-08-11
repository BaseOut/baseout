/**
 * The single AI-routing seam (shared-ai-byok task 3.2, design D2).
 *
 * Consumed identically at all three AI entry points (Schema Chat, schema
 * descriptions, health scoring). It answers "WHOSE credentials + bill does this
 * (already-permitted) call use" — never "IS this call allowed"; the `ai_usage`
 * policy gate (shared-ai-controls, design D3) resolves FIRST and is the security
 * boundary, so BYOK never widens scope.
 *
 * Returns `{ mode: 'pool' }` for everyone today: the injected deps aren't wired
 * to real data until tasks 3.3/4, so behavior is identical to current
 * production. `byok` is chosen ONLY when the org resolves `byo_ai_key = true`
 * AND has an `active` key for a supported provider.
 *
 * SECURITY (design review point #2): the return shape carries NO secret material
 * and is safe to log/trace. Call sites fetch the decrypted key over the trusted
 * boundary via the gated credential endpoint (task 3.3), never from here.
 *
 * Pure function of (orgId, deps) — deps are injected so it unit-tests with no DB.
 */

// Supported providers at launch (design D8). A self-contained literal set so
// this pure seam pulls in no schema-package weight — kept in step with the
// `ai_provider_keys` CHECK constraint (apps/web ai-provider-keys.ts AI_PROVIDERS).
const SUPPORTED_PROVIDERS = new Set(["anthropic", "openai", "cloudflare"]);

/** The active-key facts the seam needs — deliberately NO key material. */
export interface ActiveProviderKey {
  provider: string;
  modelDefault: string | null;
}

export interface ResolveAiRoutingDeps {
  /** Resolves `byo_ai_key` from the DB-native catalog (never Stripe metadata). */
  isByokEntitled: (orgId: string) => Promise<boolean>;
  /** The org's active BYOK key facts, or null when none — carries no secret. */
  findActiveKey: (orgId: string) => Promise<ActiveProviderKey | null>;
}

export type AiRouting =
  | { mode: "pool" }
  | { mode: "byok"; provider: string; model: string | null; billable: false };

export async function resolveAiRouting(
  orgId: string,
  deps: ResolveAiRoutingDeps,
): Promise<AiRouting> {
  if (!(await deps.isByokEntitled(orgId))) return { mode: "pool" };

  const key = await deps.findActiveKey(orgId);
  if (!key || !SUPPORTED_PROVIDERS.has(key.provider)) return { mode: "pool" };

  return {
    mode: "byok",
    provider: key.provider,
    model: key.modelDefault,
    // BYOK consumes zero AI credits (design D4) — the flag the forthcoming
    // meter (shared-entitlements 3.3) will honor; the meter itself is unwired.
    billable: false,
  };
}

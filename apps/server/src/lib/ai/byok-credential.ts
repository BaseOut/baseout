/**
 * In-process BYOK credential decrypt + adapter resolution (shared-ai-byok
 * task 4.2).
 *
 * The two engine AI adapters (describe-schema-io, health-score-run) run INSIDE
 * the Worker, so — unlike the workflows chat task (task 4.1, which fetches the
 * plaintext over the SERVER_INTERNAL_TOKEN-gated credential endpoint, task 3.3) —
 * they can decrypt the stored `ai_provider_keys.key_enc` ciphertext directly
 * with the master encryption key already in the Worker's env. This reuses the
 * EXACT AES-256-GCM decrypt path used for OAuth / storage tokens
 * (lib/crypto.ts `decryptToken`) and the same `env.BASEOUT_ENCRYPTION_KEY`.
 *
 * SECURITY (design review point #2): the decrypted plaintext is used ONLY to
 * construct the outbound provider request in-scope (provider-call.ts). It is
 * NEVER logged, returned in an HTTP response, or placed on any Trigger.dev
 * payload. `ByokAdapterConfig` deliberately carries the plaintext only as an
 * in-process, in-scope value handed straight to `callByokModel`.
 */

import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import { aiProviderKeys, spaces } from "../../db/schema";
import { decryptToken } from "../crypto";
import { resolveAiRouting, type ResolveAiRoutingDeps } from "./resolve-ai-routing";
import { findActiveKey, isByokEntitled } from "./provider-keys-io";
import { isCallableByokProvider } from "./provider-call";

/** Injected decrypt for tests; defaults to the real AES-256-GCM path. */
export type DecryptFn = (ciphertext: string, keyB64: string) => Promise<string>;

/** The in-scope BYOK routing decision + plaintext key for one call site. */
export interface ByokAdapterConfig {
  provider: string;
  /** The org's `model_default` (may be null → provider default downstream). */
  model: string | null;
  /** Plaintext API key — in-process only; never log/return/serialize. */
  apiKey: string;
}

/**
 * Resolve + decrypt the org's active key for `provider`. Returns the plaintext
 * API key, or null when the org has no active key for that provider. Never
 * throws for a missing key — a null is the "fall back to pool" signal.
 */
export async function resolveByokCredential(
  db: AppDb,
  encryptionKey: string,
  organizationId: string,
  provider: string,
  decrypt: DecryptFn = decryptToken,
): Promise<string | null> {
  const [row] = await db
    .select({ keyEnc: aiProviderKeys.keyEnc })
    .from(aiProviderKeys)
    .where(
      and(
        eq(aiProviderKeys.organizationId, organizationId),
        eq(aiProviderKeys.provider, provider),
        eq(aiProviderKeys.status, "active"),
      ),
    )
    .orderBy(desc(aiProviderKeys.modifiedAt))
    .limit(1);
  if (!row) return null;
  return decrypt(row.keyEnc, encryptionKey);
}

/**
 * Compose the AI-routing seam + credential decrypt into a ready-to-use adapter
 * config, or null when the org should use the pool (`env.AI`) path. Returns
 * null on ANY of: not `byo_ai_key`-entitled, no active key, an unsupported /
 * non-callable provider (e.g. `cloudflare`), or a key that can't be decrypted.
 * BYOK never fails the call — a null just keeps the caller on pool.
 *
 * `deps` is injectable so the composition unit-tests without a DB.
 */
export async function resolveByokAdapter(
  db: AppDb,
  encryptionKey: string,
  organizationId: string,
  deps?: {
    routing?: ResolveAiRoutingDeps;
    resolveCredential?: (provider: string) => Promise<string | null>;
  },
): Promise<ByokAdapterConfig | null> {
  const routingDeps: ResolveAiRoutingDeps = deps?.routing ?? {
    isByokEntitled: (orgId) => isByokEntitled(db, orgId),
    findActiveKey: (orgId) => findActiveKey(db, orgId),
  };
  const routing = await resolveAiRouting(organizationId, routingDeps);
  if (routing.mode !== "byok") return null;
  // A key for a provider this engine can't dispatch to (cloudflare) → pool.
  if (!isCallableByokProvider(routing.provider)) return null;

  const resolveCred =
    deps?.resolveCredential ??
    ((provider) => resolveByokCredential(db, encryptionKey, organizationId, provider));
  const apiKey = await resolveCred(routing.provider);
  if (!apiKey) return null;
  return { provider: routing.provider, model: routing.model, apiKey };
}

/**
 * Convenience for the per-Space engine call sites: resolve the Space's Org,
 * then its BYOK adapter. Null (pool) when the Space row is missing.
 */
export async function resolveByokAdapterForSpace(
  db: AppDb,
  encryptionKey: string,
  spaceId: string,
): Promise<ByokAdapterConfig | null> {
  const [row] = await db
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  if (!row) return null;
  return resolveByokAdapter(db, encryptionKey, row.organizationId);
}

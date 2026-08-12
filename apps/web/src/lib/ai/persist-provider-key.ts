/**
 * Persist a customer BYOK provider key (shared-ai-byok task 1.2, design D1).
 *
 *   1) derive display metadata: SHA-256 fingerprint + last_four (never the key)
 *   2) AES-256-GCM-encrypt the plaintext via crypto.ts `encryptToken`
 *   3) upsert ONE active row per (organization, provider) — update in place on a
 *      re-submit / rotation so the partial unique index never collides
 *
 * Pure function of (db, encryptionKey, inputs) — mirrors
 * `persistAirtableConnection` so the API route is thin and the crypto/upsert
 * logic is testable against a fake or real DB without a browser round-trip.
 *
 * SECURITY (design.md → Security review points #1/#2): the plaintext key is
 * NEVER returned and NEVER stored — only ciphertext (`key_enc`), the SHA-256
 * fingerprint, and `last_four` persist. The return value is display-only.
 */

import { and, desc, eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { aiProviderKeys } from '../../db/schema'
import { encryptToken } from '../crypto'

export interface PersistProviderKeyInputs {
  organizationId: string
  provider: string
  /** Raw customer key — encrypted before write, never persisted or returned. */
  plaintextKey: string
  label?: string | null
  modelDefault?: string | null
  createdByUserId?: string | null
}

/** Display-only result — carries NO key material by construction. */
export interface PersistProviderKeyResult {
  provider: string
  lastFour: string
  keyFingerprint: string
  status: 'active'
  /** true when an existing active row was replaced in place (rotation). */
  rotated: boolean
}

/**
 * Irreversible display metadata for a plaintext key. Exported for direct unit
 * testing (the plaintext must never round-trip out of here).
 */
export async function deriveKeyMetadata(
  plaintextKey: string,
): Promise<{ keyFingerprint: string; lastFour: string }> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(plaintextKey),
  )
  const keyFingerprint = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const lastFour = plaintextKey.slice(-4)
  return { keyFingerprint, lastFour }
}

export async function persistProviderKey(
  db: AppDb,
  encryptionKey: string,
  inputs: PersistProviderKeyInputs,
): Promise<PersistProviderKeyResult> {
  const { keyFingerprint, lastFour } = await deriveKeyMetadata(inputs.plaintextKey)
  const keyEnc = await encryptToken(inputs.plaintextKey, encryptionKey)
  const now = new Date()

  // One ACTIVE key per (org, provider). If one exists, replace it in place
  // (rotation / re-submit) rather than inserting a duplicate that would trip
  // the partial unique index.
  const [existing] = await db
    .select({ id: aiProviderKeys.id })
    .from(aiProviderKeys)
    .where(
      and(
        eq(aiProviderKeys.organizationId, inputs.organizationId),
        eq(aiProviderKeys.provider, inputs.provider),
        eq(aiProviderKeys.status, 'active'),
      ),
    )
    .orderBy(desc(aiProviderKeys.modifiedAt))
    .limit(1)

  if (existing) {
    await db
      .update(aiProviderKeys)
      .set({
        keyEnc,
        keyFingerprint,
        lastFour,
        label: inputs.label ?? null,
        modelDefault: inputs.modelDefault ?? null,
        createdByUserId: inputs.createdByUserId ?? null,
        status: 'active',
        validationError: null,
        modifiedAt: now,
      })
      .where(eq(aiProviderKeys.id, existing.id))
  } else {
    await db
      .insert(aiProviderKeys)
      .values({
        organizationId: inputs.organizationId,
        provider: inputs.provider,
        keyEnc,
        keyFingerprint,
        lastFour,
        label: inputs.label ?? null,
        modelDefault: inputs.modelDefault ?? null,
        createdByUserId: inputs.createdByUserId ?? null,
        status: 'active',
      })
      .returning({ id: aiProviderKeys.id })
  }

  return {
    provider: inputs.provider,
    lastFour,
    keyFingerprint,
    status: 'active',
    rotated: Boolean(existing),
  }
}

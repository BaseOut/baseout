/**
 * Master-key encryption storage hook for the better-auth `twoFactor` plugin
 * (web-auth-2fa task 1.1; design Decision 2).
 *
 * better-auth already encrypts the TOTP secret + backup codes with
 * BETTER_AUTH_SECRET before handing them to the adapter. This wrapper adds
 * the SAME at-rest posture as OAuth token *_enc columns (PRD §20.2): an
 * AES-256-GCM layer under the master key (BASEOUT_ENCRYPTION_KEY) applied
 * transparently at the adapter boundary — encrypt on create/update, decrypt
 * on read — so the plugin keeps seeing its own ciphertext layer and no
 * plugin internals are re-implemented.
 *
 * When the master key is not configured (e.g. a fresh dev clone), the
 * wrapper passes through: the plugin-native encryption layer still applies,
 * so secrets are never stored raw.
 *
 * Also the one reliable place to observe enrollment ACTIVATION (the
 * `verified: true` flip written by verify-totp) — surfaced via
 * `onActivated` for the audit/notification pipeline.
 */

import { decryptToken, encryptToken } from '../crypto'

const TWO_FACTOR_MODEL = 'twoFactor'
const ENCRYPTED_FIELDS = ['secret', 'backupCodes'] as const

type AnyRecord = Record<string, unknown>

interface AdapterCallArgs extends AnyRecord {
  model?: string
  data?: AnyRecord
  update?: AnyRecord
}

export interface TwoFactorEncryptionOptions {
  /** Fired when a twoFactor row's `verified` flips to true (activation). */
  onActivated?: (userId: string | null) => void | Promise<void>
}

async function encryptFields(
  record: AnyRecord,
  key: string,
): Promise<AnyRecord> {
  const out = { ...record }
  for (const field of ENCRYPTED_FIELDS) {
    const value = out[field]
    if (typeof value === 'string') {
      out[field] = await encryptToken(value, key)
    }
  }
  return out
}

async function decryptFields(
  record: unknown,
  key: string,
): Promise<unknown> {
  if (!record || typeof record !== 'object') return record
  const out = { ...(record as AnyRecord) }
  for (const field of ENCRYPTED_FIELDS) {
    const value = out[field]
    if (typeof value === 'string') {
      try {
        out[field] = await decryptToken(value, key)
      } catch {
        // Row predates the master-key layer (or key rotated): return the
        // stored value unchanged — the plugin's own decryption will reject
        // it loudly rather than us corrupting it here.
      }
    }
  }
  return out
}

/**
 * Wrap a better-auth adapter FACTORY (e.g. `drizzleAdapter(db, cfg)`) so
 * twoFactor rows get the master-key layer. Non-twoFactor models pass
 * through untouched.
 */
export function withTwoFactorSecretEncryption<
  F extends (...args: never[]) => unknown,
>(
  createAdapter: F,
  masterKey: string | undefined,
  options?: TwoFactorEncryptionOptions,
): F {
  const wrapped = ((...args: never[]) => {
    const adapter = createAdapter(...args) as AnyRecord

    const proxied = new Proxy(adapter, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original

        if (prop === 'create' || prop === 'update' || prop === 'updateMany') {
          return async (callArgs: AdapterCallArgs, ...rest: unknown[]) => {
            let forwarded = callArgs
            const isTwoFactor = callArgs?.model === TWO_FACTOR_MODEL
            if (isTwoFactor && masterKey) {
              forwarded = { ...callArgs }
              if (forwarded.data) {
                forwarded.data = await encryptFields(forwarded.data, masterKey)
              }
              if (forwarded.update) {
                forwarded.update = await encryptFields(forwarded.update, masterKey)
              }
            }
            const result = await (original as (...a: unknown[]) => Promise<unknown>).call(
              target,
              forwarded,
              ...rest,
            )
            if (
              isTwoFactor &&
              prop === 'update' &&
              (callArgs.update as AnyRecord | undefined)?.verified === true
            ) {
              const row = result as AnyRecord | null
              await options?.onActivated?.(
                typeof row?.userId === 'string' ? row.userId : null,
              )
            }
            if (isTwoFactor && masterKey && result && typeof result === 'object' && !Array.isArray(result)) {
              return decryptFields(result, masterKey)
            }
            return result
          }
        }

        if (prop === 'findOne' || prop === 'findMany') {
          return async (callArgs: AdapterCallArgs, ...rest: unknown[]) => {
            const result = await (original as (...a: unknown[]) => Promise<unknown>).call(
              target,
              callArgs,
              ...rest,
            )
            if (callArgs?.model !== TWO_FACTOR_MODEL || !masterKey) return result
            if (Array.isArray(result)) {
              return Promise.all(result.map((row) => decryptFields(row, masterKey)))
            }
            return decryptFields(result, masterKey)
          }
        }

        return original.bind(target)
      },
    })

    return proxied
  }) as F
  return wrapped
}

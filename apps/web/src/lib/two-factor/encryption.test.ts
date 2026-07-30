/**
 * Adapter storage-hook tests: TOTP secrets + backup codes are AES-256-GCM
 * encrypted at rest with the master key (web-auth-2fa task 1.1, design
 * Decision 2 — "plugin-native everything" plus one master-key layer).
 */

import { describe, expect, it, vi } from 'vitest'
import { generateEncryptionKey, decryptToken } from '../crypto'
import { withTwoFactorSecretEncryption } from './encryption'

interface Row extends Record<string, unknown> {
  id: string
}

/** Minimal in-memory adapter faking the better-auth adapter surface. */
function makeFakeAdapter(store: Map<string, Row>) {
  return {
    id: 'fake',
    create: vi.fn(async ({ data }: { model: string; data: Row }) => {
      const row = { ...data, id: data.id ?? `row_${store.size + 1}` }
      store.set(row.id as string, row)
      return { ...row }
    }),
    findOne: vi.fn(async ({ where }: { model: string; where: Array<{ field: string; value: unknown }> }) => {
      const [w] = where
      for (const row of store.values()) {
        if (row[w.field] === w.value) return { ...row }
      }
      return null
    }),
    findMany: vi.fn(async () => [...store.values()].map((r) => ({ ...r }))),
    update: vi.fn(async ({ where, update }: { model: string; where: Array<{ field: string; value: unknown }>; update: Row }) => {
      const [w] = where
      for (const row of store.values()) {
        if (row[w.field] === w.value) {
          Object.assign(row, update)
          return { ...row }
        }
      }
      return null
    }),
    updateMany: vi.fn(async () => 0),
    delete: vi.fn(async () => {}),
    deleteMany: vi.fn(async () => 0),
    count: vi.fn(async () => 0),
  }
}

const KEY = generateEncryptionKey()

function wrap(store: Map<string, Row>, opts?: { onActivated?: (userId: string | null) => void }) {
  const base = makeFakeAdapter(store)
  const factory = withTwoFactorSecretEncryption(() => base, KEY, opts)
  return { base, adapter: factory() as unknown as typeof base }
}

describe('withTwoFactorSecretEncryption', () => {
  it('encrypts secret + backupCodes on create; stored values differ from input', async () => {
    const store = new Map<string, Row>()
    const { adapter } = wrap(store)
    await adapter.create({
      model: 'twoFactor',
      data: { secret: 'plugin-ciphertext', backupCodes: 'codes-blob', userId: 'u1', verified: false } as unknown as Row,
    })
    const stored = [...store.values()][0]
    expect(stored.secret).not.toBe('plugin-ciphertext')
    expect(stored.backupCodes).not.toBe('codes-blob')
    // Round-trips with the master key — proves AES-GCM under KEY, not a hash.
    expect(await decryptToken(stored.secret as string, KEY)).toBe('plugin-ciphertext')
    expect(await decryptToken(stored.backupCodes as string, KEY)).toBe('codes-blob')
  })

  it('decrypts on findOne so the plugin sees its own ciphertext layer', async () => {
    const store = new Map<string, Row>()
    const { adapter } = wrap(store)
    await adapter.create({
      model: 'twoFactor',
      data: { secret: 's1', backupCodes: 'b1', userId: 'u1', verified: false } as unknown as Row,
    })
    const row = (await adapter.findOne({
      model: 'twoFactor',
      where: [{ field: 'userId', value: 'u1' }],
    })) as Row
    expect(row.secret).toBe('s1')
    expect(row.backupCodes).toBe('b1')
  })

  it('encrypts updated backupCodes and leaves other models untouched', async () => {
    const store = new Map<string, Row>()
    const { adapter } = wrap(store)
    await adapter.create({
      model: 'twoFactor',
      data: { id: 'tf1', secret: 's', backupCodes: 'b', userId: 'u1', verified: false } as unknown as Row,
    })
    await adapter.update({
      model: 'twoFactor',
      where: [{ field: 'id', value: 'tf1' }],
      update: { backupCodes: 'b-consumed' } as unknown as Row,
    })
    expect(store.get('tf1')!.backupCodes).not.toBe('b-consumed')
    expect(await decryptToken(store.get('tf1')!.backupCodes as string, KEY)).toBe('b-consumed')

    // Non-twoFactor models pass through untouched.
    await adapter.create({
      model: 'user',
      data: { id: 'u9', secret: 'not-a-totp-secret' } as unknown as Row,
    })
    expect(store.get('u9')!.secret).toBe('not-a-totp-secret')
  })

  it('fires onActivated when verified flips true (enrollment activation)', async () => {
    const store = new Map<string, Row>()
    const onActivated = vi.fn()
    const { adapter } = wrap(store, { onActivated })
    await adapter.create({
      model: 'twoFactor',
      data: { id: 'tf1', secret: 's', backupCodes: 'b', userId: 'u1', verified: false } as unknown as Row,
    })
    await adapter.update({
      model: 'twoFactor',
      where: [{ field: 'id', value: 'tf1' }],
      update: { verified: true } as unknown as Row,
    })
    expect(onActivated).toHaveBeenCalledWith('u1')
  })

  it('passes through unencrypted when no master key is configured', async () => {
    const store = new Map<string, Row>()
    const base = makeFakeAdapter(store)
    const adapter = withTwoFactorSecretEncryption(() => base, undefined)() as unknown as ReturnType<typeof makeFakeAdapter>
    await adapter.create({
      model: 'twoFactor',
      data: { secret: 's1', backupCodes: 'b1', userId: 'u1', verified: false } as unknown as Row,
    })
    expect([...store.values()][0].secret).toBe('s1')
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { is, Table, getTableColumns, getTableName } from 'drizzle-orm'
import * as coreSchema from '../db/schema/core'

// admin-data-boundary (admin-entity-linking D5): the staff console reads ONLY
// master-DB metadata. This guard makes the boundary enforceable, not just
// commented: no mirrored column may be a secret (`*_enc`), the wrangler config
// declares no D1 binding and exactly one Hyperdrive (no per-Space DB reach), and
// no code path selects a session `token`.

describe('admin data boundary', () => {
  it('no mirrored column is an encrypted secret (*_enc)', () => {
    for (const value of Object.values(coreSchema)) {
      if (!is(value, Table)) continue
      const cols = Object.values(getTableColumns(value)).map((c) => c.name)
      const enc = cols.filter((n) => n.endsWith('_enc'))
      expect(enc, `${getTableName(value)} must not mirror *_enc columns`).toEqual([])
    }
  })

  it('wrangler config declares no D1 binding and exactly one Hyperdrive', () => {
    const cfg = readFileSync(fileURLToPath(new URL('../../wrangler.jsonc.example', import.meta.url)), 'utf8')
    expect(/d1_databases/.test(cfg), 'admin must not bind a D1 database (no per-Space DB reach)').toBe(false)
    const hyperdriveBindings = (cfg.match(/"binding":\s*"HYPERDRIVE"/g) ?? []).length
    expect(hyperdriveBindings, 'exactly one Hyperdrive binding').toBe(1)
  })

  it('no source file selects a session token into output (WHERE-by-token lookups are fine)', () => {
    // Forbidden: exposing the token in a select projection (`token: sessions.token`).
    // Allowed: authenticating by it (`inArray(sessions.token, …)` in the gate/handoff).
    const EXPOSE = /\btoken\s*:\s*sessions\.token\b/
    const srcDir = fileURLToPath(new URL('..', import.meta.url))
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name)
        if (e.isDirectory()) return walk(p)
        return /\.(ts|astro)$/.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : []
      })
    })(srcDir)
    for (const f of files) {
      expect(EXPOSE.test(readFileSync(f, 'utf8')), `${f} must not select sessions.token into output`).toBe(false)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// App-layer stand-in for the deferred INSERT-only Postgres role (parent
// `admin` change tasks 5.1/5.3): no admin code path may UPDATE or DELETE
// admin_audit_log rows. Outcome is recorded as a second appended row.
const srcDir = fileURLToPath(new URL('..', import.meta.url))

const VIOLATION = /\.(update|delete)\(\s*adminAuditLog\b|(update|delete)\s+(baseout\.)?admin_audit_log/i

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    return /\.(ts|astro)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('admin_audit_log append-only guard', () => {
  it('detects violations (matcher self-check)', () => {
    expect(VIOLATION.test('db.update(adminAuditLog).set({})')).toBe(true)
    expect(VIOLATION.test('db.delete(adminAuditLog)')).toBe(true)
    expect(VIOLATION.test('sql`update baseout.admin_audit_log set params = null`')).toBe(true)
    expect(VIOLATION.test('db.insert(adminAuditLog).values({})')).toBe(false)
  })

  it('has no UPDATE/DELETE call site against admin_audit_log anywhere in src', () => {
    for (const file of listSourceFiles(srcDir)) {
      const content = readFileSync(file, 'utf8')
      expect(VIOLATION.test(content), `${file} must not mutate admin_audit_log`).toBe(false)
    }
  })
})

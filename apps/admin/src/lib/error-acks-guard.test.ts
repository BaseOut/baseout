import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// admin-error-triage: admin_error_acks is APPEND-ONLY — acks INSERT phase rows,
// never UPDATE/DELETE (effective state = latest phase row). Same source-scanning
// guard as admin_audit_log; INSERT is permitted (unlike the read-only mirrors).
const srcDir = fileURLToPath(new URL('..', import.meta.url))
const VIOLATION = /\.(update|delete)\(\s*adminErrorAcks\b|(update|delete)\s+(baseout\.)?admin_error_acks/i

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    return /\.(ts|astro)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('admin_error_acks append-only guard', () => {
  it('detects UPDATE/DELETE violations but allows INSERT (matcher self-check)', () => {
    expect(VIOLATION.test('db.update(adminErrorAcks).set({})')).toBe(true)
    expect(VIOLATION.test('db.delete(adminErrorAcks)')).toBe(true)
    expect(VIOLATION.test('db.insert(adminErrorAcks).values(row)')).toBe(false)
  })

  it('has no UPDATE/DELETE call site against admin_error_acks anywhere in src', () => {
    for (const file of listSourceFiles(srcDir)) {
      expect(VIOLATION.test(readFileSync(file, 'utf8')), `${file} must not mutate admin_error_acks`).toBe(false)
    }
  })
})

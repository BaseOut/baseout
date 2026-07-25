import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// shared-service-runs: the admin `service_runs` mirror is READ-ONLY — apps/server
// owns all writes (withServiceRun). No admin code path may INSERT/UPDATE/DELETE
// it. Same source-scanning guard shape as the admin_audit_log append-only test.
const srcDir = fileURLToPath(new URL('..', import.meta.url))

const VIOLATION = /\.(insert|update|delete)\(\s*serviceRuns\b|(insert into|update|delete from)\s+(baseout\.)?service_runs/i

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    return /\.(ts|astro)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('service_runs read-only guard (admin)', () => {
  it('detects violations (matcher self-check)', () => {
    expect(VIOLATION.test('db.insert(serviceRuns).values({})')).toBe(true)
    expect(VIOLATION.test('db.update(serviceRuns).set({})')).toBe(true)
    expect(VIOLATION.test('db.delete(serviceRuns)')).toBe(true)
    expect(VIOLATION.test('db.select().from(serviceRuns)')).toBe(false)
  })

  it('has no INSERT/UPDATE/DELETE call site against service_runs anywhere in src', () => {
    for (const file of listSourceFiles(srcDir)) {
      const content = readFileSync(file, 'utf8')
      expect(VIOLATION.test(content), `${file} must not write service_runs`).toBe(false)
    }
  })
})

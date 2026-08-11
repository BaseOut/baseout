import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The staff /ops console was absorbed by apps/admin's /backups surface
// (openspec/changes/admin-read-surfaces task 3.3). Its role gate
// (applyOpsGate) no longer exists in middleware, so any page re-added
// here would expose cross-org backup data to every signed-in customer.
// With Astro file-based routing, the absence of the directory IS the 404.
const opsDir = fileURLToPath(new URL('./ops/', import.meta.url));

describe('retired /ops staff console', () => {
  it('has no pages under src/pages/ops/ — staff backup views live in apps/admin', () => {
    expect(existsSync(opsDir)).toBe(false);
  });
});
